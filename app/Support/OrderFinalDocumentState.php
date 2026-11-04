<?php

namespace App\Support;

use App\Enums\OrderDocumentType;
use App\Enums\TrackBDocStatus;
use App\Models\Order;

class OrderFinalDocumentState
{
    public function sync(Order $order): void
    {
        $order->loadMissing('collaterals.jobs.documents');

        foreach ($order->collaterals as $collateral) {
            if ($collateral->jobs->isEmpty()) {
                continue;
            }

            $allUploaded = $collateral->jobs->every(fn ($job) => $this->finalDocuments($job)->isNotEmpty());
            $allValidated = $allUploaded && $collateral->jobs->every(fn ($job) => $this->finalDocuments($job)->every(fn ($document) => $document->validated_at !== null));

            if ($allValidated) {
                $collateral->update(['doc_status' => TrackBDocStatus::FinalDivalidasi]);
            } elseif ($allUploaded) {
                $collateral->update(['doc_status' => TrackBDocStatus::FinalDiunggah]);
            }

            foreach ($collateral->jobs as $job) {
                $documents = $this->finalDocuments($job);
                if ($documents->isEmpty()) {
                    continue;
                }
                $job->update(['status' => $documents->every(fn ($document) => $document->validated_at !== null)
                    ? TrackBDocStatus::FinalDivalidasi
                    : TrackBDocStatus::FinalDiunggah]);
            }
        }
    }

    public function allUploaded(Order $order): bool
    {
        $order->loadMissing('collaterals.jobs.documents');

        return $order->collaterals->every(fn ($collateral) => $collateral->jobs->isNotEmpty()
            && $collateral->jobs->every(fn ($job) => $this->finalDocuments($job)->isNotEmpty()));
    }

    public function allValidated(Order $order): bool
    {
        $order->loadMissing('collaterals.jobs.documents');

        return $order->collaterals->every(fn ($collateral) => $collateral->jobs->isNotEmpty()
            && $collateral->jobs->every(fn ($job) => $this->finalDocuments($job)->isNotEmpty()
                && $this->finalDocuments($job)->every(fn ($document) => $document->validated_at !== null)));
    }

    private function finalDocuments($job)
    {
        return $job->documents->where('document_type', OrderDocumentType::Final);
    }
}
