<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/announcements/index', [
            'announcements' => Announcement::query()
                ->with('creator:id,name')
                ->latest('created_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Announcement $announcement) => $this->present($announcement)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $announcement = Announcement::create([
            ...$data,
            'image_path' => $request->file('image')?->store('announcements', 'public'),
            'status' => $request->boolean('publish') ? 'published' : 'draft',
            'published_at' => $request->boolean('publish') ? now() : null,
            'created_by' => $request->user()->id,
        ]);

        Audit::record($request, 'announcements', $announcement, 'create_announcement', 'Siaran operasional dibuat.', [
            'after' => $announcement->only(['title', 'status', 'priority', 'published_at', 'expires_at', 'link_url']),
        ]);

        return back()->with('success', $announcement->status === 'published' ? 'Siaran operasional diterbitkan.' : 'Siaran disimpan sebagai draft.');
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $data = $this->validated($request);
        $before = $announcement->only(['title', 'status', 'priority', 'published_at', 'expires_at', 'link_url']);

        if ($request->hasFile('image')) {
            if ($announcement->image_path) {
                Storage::disk('public')->delete($announcement->image_path);
            }
            $data['image_path'] = $request->file('image')->store('announcements', 'public');
        }

        $data['status'] = $request->boolean('publish') ? 'published' : ($announcement->status === 'published' ? 'archived' : 'draft');
        $data['published_at'] = $request->boolean('publish') ? ($announcement->published_at ?? now()) : $announcement->published_at;
        $announcement->update($data);

        Audit::record($request, 'announcements', $announcement, 'update_announcement', 'Siaran operasional diperbarui.', [
            'before' => $before,
            'after' => $announcement->fresh()->only(['title', 'status', 'priority', 'published_at', 'expires_at', 'link_url']),
        ]);

        return back()->with('success', 'Siaran operasional diperbarui.');
    }

    public function markRead(Request $request, Announcement $announcement): RedirectResponse
    {
        abort_unless($announcement->scopePublished(Announcement::query())->whereKey($announcement->id)->exists(), 404);
        $announcement->readers()->syncWithoutDetaching([$request->user()->id => ['read_at' => now()]]);

        return back();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'body' => ['required', 'string', 'max:10000'],
            'link_url' => ['nullable', 'url', 'max:2048'],
            'priority' => ['required', Rule::in(['normal', 'important'])],
            'expires_at' => ['nullable', 'date', 'after:today'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);
    }

    private function present(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'link_url' => $announcement->link_url,
            'image_url' => $announcement->image_path ? Storage::disk('public')->url($announcement->image_path) : null,
            'status' => $announcement->status,
            'priority' => $announcement->priority,
            'published_at' => $announcement->published_at?->format('d M Y H:i'),
            'expires_at' => $announcement->expires_at?->format('d M Y H:i'),
            'created_by' => $announcement->creator?->name ?? 'Sistem',
            'created_at' => $announcement->created_at?->format('d M Y H:i'),
        ];
    }
}
