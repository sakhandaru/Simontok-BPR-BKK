<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ArchiveLegacyData extends Command
{
    protected $signature = 'legacy:archive-import
        {--path= : Path to the selected legacy SQL dump}
        {--dry-run : Parse the dump and report counts without writing to the database}';

    protected $description = 'Archive every row from the selected legacy SQL dump without mapping or discarding source fields.';

    private int $chunkSize = 500;

    public function handle(): int
    {
        $path = $this->option('path') ?: base_path('data_simontok_yang_dipindah.sql');

        if (! is_file($path) || ! is_readable($path)) {
            $this->error("Dump legacy tidak ditemukan atau tidak bisa dibaca: {$path}");

            return self::FAILURE;
        }

        $hash = hash_file('sha256', $path);
        if ($hash === false) {
            $this->error('Hash dump legacy gagal dihitung.');

            return self::FAILURE;
        }

        $sql = file_get_contents($path);
        if ($sql === false) {
            $this->error('Dump legacy gagal dibaca.');

            return self::FAILURE;
        }

        $counts = [];
        $recordCount = 0;

        if ($this->option('dry-run')) {
            try {
                $this->parseDump($sql, static function (string $table, int $rowNumber, array $row) use (&$counts, &$recordCount): void {
                    $counts[$table] = ($counts[$table] ?? 0) + 1;
                    $recordCount++;
                });
            } catch (RuntimeException $exception) {
                $this->error($exception->getMessage());

                return self::FAILURE;
            }

            $this->tableCounts($counts, $recordCount);
            $this->info('Dry-run selesai; tidak ada data yang ditulis.');

            return self::SUCCESS;
        }

        $batch = DB::table('legacy_import_batches')->where('source_sha256', $hash)->first();
        if ($batch && $batch->status === 'completed') {
            $this->info("Dump ini sudah diarsipkan (batch {$batch->id}, {$batch->record_count} record). Tidak ada duplikasi dibuat.");

            return self::SUCCESS;
        }

        $now = now();
        $batchId = $batch?->id ?? DB::table('legacy_import_batches')->insertGetId([
            'source_file' => basename($path),
            'source_sha256' => $hash,
            'status' => 'running',
            'started_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('legacy_import_batches')->where('id', $batchId)->update([
            'source_file' => basename($path),
            'status' => 'running',
            'started_at' => $now,
            'completed_at' => null,
            'updated_at' => $now,
        ]);

        try {
            $this->parseDump($sql, function (string $table, int $rowNumber, array $row) use ($batchId, &$counts, &$recordCount): void {
                $counts[$table] = ($counts[$table] ?? 0) + 1;
                $recordCount++;

                $key = $this->sourceKey($row);
                $payload = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
                if ($payload === false) {
                    throw new RuntimeException("Baris {$rowNumber} pada {$table} gagal dikonversi ke JSON.");
                }

                $this->pendingRows[] = [
                    'batch_id' => $batchId,
                    'source_table' => $table,
                    'source_row_number' => $rowNumber,
                    'source_key' => $key,
                    'payload' => $payload,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if (count($this->pendingRows) >= $this->chunkSize) {
                    $this->flushRows();
                }
            });

            $this->flushRows();

            DB::table('legacy_import_batches')->where('id', $batchId)->update([
                'status' => 'completed',
                'record_count' => $recordCount,
                'table_counts' => json_encode($counts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (RuntimeException $exception) {
            $this->flushRows();
            DB::table('legacy_import_batches')->where('id', $batchId)->update([
                'status' => 'failed',
                'record_count' => DB::table('legacy_import_records')->where('batch_id', $batchId)->count(),
                'table_counts' => json_encode($counts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);

            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->tableCounts($counts, $recordCount);
        $this->info("Arsip selesai. Batch ID: {$batchId}. Data operasional tidak diubah.");

        return self::SUCCESS;
    }

    /** @var array<int, array<string, mixed>> */
    private array $pendingRows = [];

    private function flushRows(): void
    {
        if ($this->pendingRows === []) {
            return;
        }

        DB::table('legacy_import_records')->upsert(
            $this->pendingRows,
            ['batch_id', 'source_table', 'source_row_number'],
            ['source_key', 'payload', 'updated_at'],
        );

        $this->pendingRows = [];
    }

    /** @param callable(string, int, array<string, string|null>): void $onRow */
    private function parseDump(string $sql, callable $onRow): void
    {
        $pattern = '/INSERT INTO `([^`]+)`\s*\((.*?)\)\s*VALUES\s*/s';
        if (preg_match_all($pattern, $sql, $matches, PREG_OFFSET_CAPTURE) === false) {
            throw new RuntimeException('Statement INSERT pada dump tidak bisa dibaca.');
        }

        $tableRows = [];
        foreach ($matches[0] as $index => [$statementPrefix, $statementOffset]) {
            $table = $matches[1][$index][0];
            $columnSql = $matches[2][$index][0];
            preg_match_all('/`([^`]+)`/', $columnSql, $columnMatches);
            $columns = $columnMatches[1];
            $cursor = $statementOffset + strlen($statementPrefix);
            $rowNumber = $tableRows[$table] ?? 0;
            $statementLength = strlen($sql);
            $inString = false;

            while ($cursor < $statementLength) {
                $this->skipWhitespaceAndCommas($sql, $cursor);
                if ($cursor >= $statementLength || $sql[$cursor] === ';') {
                    if ($cursor < $statementLength) {
                        $cursor++;
                    }
                    break;
                }

                if ($sql[$cursor] !== '(') {
                    throw new RuntimeException("Format INSERT tidak dikenali pada tabel {$table}.");
                }
                $cursor++;
                $values = [];

                while (true) {
                    $this->skipWhitespace($sql, $cursor);
                    if ($cursor >= $statementLength) {
                        throw new RuntimeException("INSERT tabel {$table} berakhir sebelum semua nilai terbaca.");
                    }

                    if ($sql[$cursor] === "'") {
                        $values[] = $this->readQuotedValue($sql, $cursor);
                    } else {
                        $values[] = $this->readUnquotedValue($sql, $cursor);
                    }

                    $this->skipWhitespace($sql, $cursor);
                    if ($cursor >= $statementLength) {
                        throw new RuntimeException("INSERT tabel {$table} berakhir sebelum penutup baris.");
                    }
                    if ($sql[$cursor] === ',') {
                        $cursor++;

                        continue;
                    }
                    if ($sql[$cursor] === ')') {
                        $cursor++;
                        break;
                    }

                    throw new RuntimeException("Pemisah nilai INSERT tidak dikenali pada tabel {$table}.");
                }

                if (count($values) !== count($columns)) {
                    throw new RuntimeException("Jumlah kolom dan nilai tidak sama pada tabel {$table}.");
                }

                $row = array_combine($columns, $values);
                if ($row === false) {
                    throw new RuntimeException("Baris INSERT tabel {$table} gagal dipasangkan dengan kolomnya.");
                }

                $rowNumber++;
                $onRow($table, $rowNumber, $row);
            }

            $tableRows[$table] = $rowNumber;
        }

        if ($matches[0] === []) {
            throw new RuntimeException('Dump tidak memiliki statement INSERT yang bisa diarsipkan.');
        }
    }

    private function skipWhitespace(string $sql, int &$cursor): void
    {
        $length = strlen($sql);
        while ($cursor < $length && ctype_space($sql[$cursor])) {
            $cursor++;
        }
    }

    private function skipWhitespaceAndCommas(string $sql, int &$cursor): void
    {
        $length = strlen($sql);
        while ($cursor < $length && (ctype_space($sql[$cursor]) || $sql[$cursor] === ',')) {
            $cursor++;
        }
    }

    private function readQuotedValue(string $sql, int &$cursor): string
    {
        $cursor++;
        $value = '';
        $length = strlen($sql);

        while ($cursor < $length) {
            $char = $sql[$cursor++];

            if ($char === "'") {
                if ($cursor < $length && $sql[$cursor] === "'") {
                    $value .= "'";
                    $cursor++;

                    continue;
                }

                return $value;
            }

            if ($char === '\\' && $cursor < $length) {
                $escaped = $sql[$cursor++];
                $value .= match ($escaped) {
                    '0' => "\0",
                    'b' => "\x08",
                    'n' => "\n",
                    'r' => "\r",
                    't' => "\t",
                    'Z' => "\x1a",
                    default => $escaped,
                };

                continue;
            }

            $value .= $char;
        }

        throw new RuntimeException('Nilai teks SQL tidak memiliki tanda kutip penutup.');
    }

    private function readUnquotedValue(string $sql, int &$cursor): ?string
    {
        $start = $cursor;
        $length = strlen($sql);

        while ($cursor < $length && $sql[$cursor] !== ',' && $sql[$cursor] !== ')') {
            $cursor++;
        }

        $value = trim(substr($sql, $start, $cursor - $start));

        return strtoupper($value) === 'NULL' ? null : $value;
    }

    /** @param array<string, string|null> $row */
    private function sourceKey(array $row): ?string
    {
        foreach ($row as $column => $value) {
            if (str_starts_with($column, 'id_') && $value !== null && $value !== '') {
                return mb_substr($value, 0, 120);
            }
        }

        return null;
    }

    /** @param array<string, int> $counts */
    private function tableCounts(array $counts, int $total): void
    {
        ksort($counts);
        $rows = [];
        foreach ($counts as $table => $count) {
            $rows[] = [$table, number_format($count)];
        }
        $this->table(['Tabel sumber', 'Baris'], $rows);
        $this->info('Total: '.number_format($total).' baris.');
    }
}
