<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\DocumentArchive;
use App\Models\Notary;
use App\Models\Order;
use App\Models\OrderCollateral;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DocumentArchiveController extends Controller
{
    public function index(Request $request): Response
    {
        abort_if($request->user()?->notary_id, 403);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'status' => ['nullable', 'in:active,archived'],
            'category' => ['nullable', 'string', 'max:60'],
        ]);

        $filtered = DocumentArchive::query()
            ->with(['documentable', 'uploader:id,name'])
            ->when($request->user()?->branchScopeId(), function ($query, int $branchId): void {
                $query->where(function ($query) use ($branchId): void {
                    $query
                        ->whereHasMorph('documentable', [OrderCollateral::class], fn ($collateral) => $collateral->whereHas('order', fn ($order) => $order->where('branch_id', $branchId)))
                        ->orWhereHasMorph('documentable', [Order::class], fn ($order) => $order->where('branch_id', $branchId))
                        ->orWhereHasMorph('documentable', [Notary::class], fn ($notary) => $notary->whereHas('branches', fn ($branch) => $branch->whereKey($branchId)->where('branch_notary.is_active', true)));
                });
            })
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('original_name', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhereHasMorph('documentable', [Notary::class], fn ($notary) => $notary->where('name', 'like', "%{$search}%"))
                        ->orWhereHasMorph('documentable', [OrderCollateral::class], fn ($collateral) => $collateral->where('nama_agunan', 'like', "%{$search}%")->orWhere('agunan_id', 'like', "%{$search}%"));
                });
            })
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('documentable_type', Notary::class)->where('documentable_id', $notaryId))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['category'] ?? null, fn ($query, string $category) => $query->where('category', $category))
            ->latest('created_at');

        $latestIds = (clone $filtered)
            ->selectRaw('MAX(id)')
            ->groupBy('documentable_type', 'documentable_id', 'document_type', 'document_key');
        $versions = DocumentArchive::query()
            ->whereIn('id', $latestIds)
            ->with(['documentable', 'uploader:id,name'])
            ->latest('created_at');

        return Inertia::render('simontok/document-archives/index', [
            'filters' => [
                'search' => $filters['search'] ?? '',
                'notary_id' => $filters['notary_id'] ?? '',
                'status' => $filters['status'] ?? '',
                'category' => $filters['category'] ?? '',
            ],
            'notaries' => Notary::query()->when($request->user()?->branchScopeId(), fn ($query, int $branchId) => $query->whereHas('branches', fn ($query) => $query->whereKey($branchId)->where('branch_notary.is_active', true)))->orderBy('name')->get(['id', 'name']),
            'categories' => DocumentArchive::query()->distinct()->orderBy('category')->pluck('category'),
            'versions' => $versions->paginate(15)->withQueryString()->through(fn (DocumentArchive $version) => [
                'metadata' => $version->metadata,
                'documentable_type' => $version->documentable_type,
                'documentable_id' => $version->documentable_id,
                'document_key' => $version->document_key,
                'id' => $version->id,
                'notary_id' => $version->documentable_id,
                'entity_name' => $this->entityName($version),
                'version' => $version->version,
                'file_name' => $version->original_name,
                'title' => $version->title,
                'category' => $version->category,
                'document_type' => $version->document_type,
                'agreement_type' => data_get($version->metadata, 'agreement_type'),
                'pks_no' => data_get($version->metadata, 'pks_no'),
                'pks_start' => data_get($version->metadata, 'pks_start') ? date('d M Y', strtotime(data_get($version->metadata, 'pks_start'))) : null,
                'pks_end' => data_get($version->metadata, 'pks_end') ? date('d M Y', strtotime(data_get($version->metadata, 'pks_end'))) : null,
                'status' => $version->status,
                'uploaded_by' => $version->uploader?->name ?? 'Migrasi sistem',
                'created_at' => $version->created_at?->format('d M Y H:i'),
                'file_size' => $version->file_size ? number_format($version->file_size / 1024, 0).' KB' : '-',
                'version_count' => DocumentArchive::query()->where('documentable_type', $version->documentable_type)->where('documentable_id', $version->documentable_id)->where('document_type', $version->document_type)->where('document_key', $version->document_key)->count(),
            ]),
        ]);
    }

    public function versions(DocumentArchive $version): JsonResponse
    {
        $this->authorizeArchive($version);

        $versions = DocumentArchive::query()
            ->with('uploader:id,name')
            ->where('documentable_type', $version->documentable_type)
            ->where('documentable_id', $version->documentable_id)
            ->where('document_type', $version->document_type)
            ->where('document_key', $version->document_key)
            ->latest('version')
            ->get()
            ->map(fn (DocumentArchive $archive) => [
                'id' => $archive->id,
                'version' => $archive->version,
                'file_name' => $archive->original_name,
                'status' => $archive->status,
                'uploaded_by' => $archive->uploader?->name ?? 'Migrasi sistem',
                'created_at' => $archive->created_at?->format('d M Y H:i'),
                'change_note' => $archive->change_note,
                'preview_url' => "/document-archives/{$archive->id}/preview",
                'download_url' => "/document-archives/{$archive->id}/download",
            ]);

        return response()->json([
            'title' => $version->title,
            'file_name' => $version->original_name,
            'versions' => $versions,
        ]);
    }

    private function entityName(DocumentArchive $archive): string
    {
        if ($archive->documentable_type === Notary::class) {
            return $archive->documentable?->name ?? 'Notaris tidak tersedia';
        }

        if ($archive->documentable_type === OrderCollateral::class) {
            $collateral = $archive->documentable;
            $collateral?->loadMissing('order:id,order_no');

            return collect([$collateral?->order?->order_no, $collateral?->nama_agunan ?: $collateral?->agunan_id])
                ->filter()
                ->implode(' · ') ?: 'Agunan tidak tersedia';
        }

        if ($archive->documentable_type === Order::class) {
            return $archive->documentable?->order_no ?? 'Order tidak tersedia';
        }

        return 'Dokumen terkait';
    }

    public function preview(DocumentArchive $version)
    {
        $this->authorizeArchive($version);
        abort_unless(Storage::disk($version->storage_disk)->exists($version->file_path), 404);

        return response()->file(Storage::disk($version->storage_disk)->path($version->file_path), [
            'Content-Disposition' => 'inline; filename="'.addslashes($version->original_name).'"',
        ]);
    }

    public function download(DocumentArchive $version)
    {
        $this->authorizeArchive($version);
        abort_unless(Storage::disk($version->storage_disk)->exists($version->file_path), 404);

        return Storage::disk($version->storage_disk)->download($version->file_path, $version->original_name);
    }

    private function authorizeArchive(DocumentArchive $version): void
    {
        $user = request()->user();
        abort_if($user?->notary_id, 403);

        if ($user?->branchScopeId() === null) {
            return;
        }

        $version->loadMissing('documentable');
        $visible = match ($version->documentable_type) {
            OrderCollateral::class => $version->documentable?->loadMissing('order')->order?->branch_id === $user->branchScopeId(),
            Order::class => $version->documentable?->branch_id === $user->branchScopeId(),
            Notary::class => $version->documentable?->branches()->whereKey($user->branchScopeId())->where('branch_notary.is_active', true)->exists(),
            default => false,
        };

        abort_unless($visible, 404);
    }
}
