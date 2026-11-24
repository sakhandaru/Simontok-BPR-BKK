<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\DocumentChecklist;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DocumentChecklistController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return Inertia::render('simontok/masters/documents', [
            'documents' => DocumentChecklist::query()
                ->when($filters['search'] ?? null, fn ($query, string $search) => $query->where('name', 'like', "%{$search}%"))
                ->when(($filters['status'] ?? null) === 'active', fn ($query) => $query->where('is_active', true))
                ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->where('is_active', false))
                ->orderBy('name')->paginate(15)->withQueryString()
                ->through(fn (DocumentChecklist $document) => $document->only(['id', 'name', 'is_active'])),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255', 'unique:document_checklists,name']]);
        $document = DocumentChecklist::create(['name' => trim($data['name']), 'job_type_id' => null, 'is_active' => true, 'is_required' => false]);
        Audit::record($request, 'masters', $document, 'create_document_master', 'Master dokumen ditambahkan.', ['after' => $document->toArray()]);

        return back()->with('success', 'Master dokumen ditambahkan.');
    }

    public function update(Request $request, DocumentChecklist $documentChecklist): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:document_checklists,name,'.$documentChecklist->id],
            'is_active' => ['boolean'],
        ]);
        $documentChecklist->update(['name' => trim($data['name']), 'is_active' => $data['is_active'] ?? true]);
        Audit::record($request, 'masters', $documentChecklist, 'update_document_master', 'Master dokumen diperbarui.', ['after' => $documentChecklist->toArray()]);

        return back()->with('success', 'Master dokumen diperbarui.');
    }
}
