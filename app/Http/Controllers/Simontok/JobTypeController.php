<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\JobType;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class JobTypeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/masters/job-types', [
            'jobTypes' => JobType::with('steps:id,job_type_id,name,sort_order,is_active')
                ->orderBy('name')
                ->paginate(15)->withQueryString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:job_types,code'],
            'name' => ['required', 'string', 'max:255'],
            'steps' => ['nullable', 'string'],
        ]);

        $jobType = JobType::create([
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'is_active' => true,
        ]);

        collect(preg_split('/\r\n|\r|\n/', $data['steps'] ?? ''))
            ->map(fn (?string $step) => trim((string) $step))
            ->filter()
            ->values()
            ->each(fn (string $step, int $index) => $jobType->steps()->create([
                'name' => $step,
                'sort_order' => $index + 1,
                'is_active' => true,
            ]));

        Audit::record($request, 'masters', $jobType, 'create_job_type', 'Jenis pekerjaan ditambahkan.', [
            'after' => $jobType->load('steps')->toArray(),
        ]);

        return back()->with('success', 'Jenis pekerjaan ditambahkan.');
    }

    public function update(Request $request, JobType $jobType): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:job_types,code,'.$jobType->id],
            'name' => ['required', 'string', 'max:255'],
            'steps' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        DB::transaction(function () use ($jobType, $data) {
            $jobType->update(['code' => strtoupper($data['code']), 'name' => $data['name'], 'is_active' => $data['is_active'] ?? true]);
            $jobType->steps()->delete();
            collect(preg_split('/\r\n|\r|\n/', $data['steps'] ?? ''))->map(fn (?string $step) => trim((string) $step))->filter()->values()->each(fn (string $step, int $index) => $jobType->steps()->create(['name' => $step, 'sort_order' => $index + 1, 'is_active' => true]));
        });

        Audit::record($request, 'masters', $jobType, 'update_job_type', 'Jenis pekerjaan diperbarui.', ['after' => $jobType->load('steps')->toArray()]);
        return back()->with('success', 'Jenis pekerjaan diperbarui.');
    }
}
