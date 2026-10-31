<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\JobType;
use App\Models\SlaPolicy;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class JobTypeController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return Inertia::render('simontok/masters/job-types', [
            'jobTypes' => JobType::with('steps:id,job_type_id,name,sort_order,is_active')
                ->with(['slaPolicies' => fn ($query) => $query->whereNull('branch_id')->where('is_active', true)])
                ->when($filters['search'] ?? null, fn ($query, string $search) => $query->where(fn ($query) => $query->where('code', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")))
                ->when(($filters['status'] ?? null) === 'active', fn ($query) => $query->where('is_active', true))
                ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->where('is_active', false))
                ->orderBy('name')
                ->paginate(15)->withQueryString()->through(fn (JobType $jobType) => [
                    ...$jobType->only(['id', 'code', 'name', 'is_active']),
                    'steps' => $jobType->steps->map(fn ($step) => $step->only(['id', 'name', 'sort_order']))->values()->all(),
                    'sla_days' => $jobType->slaPolicies->first()?->days,
                ]),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:job_types,code'],
            'name' => ['required', 'string', 'max:255'],
            'steps' => ['nullable', 'string'],
            'sla_days' => ['required', 'integer', 'min:1', 'max:365'],
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

        SlaPolicy::updateOrCreate(
            ['job_type_id' => $jobType->id, 'branch_id' => null],
            ['days' => $data['sla_days'], 'is_active' => true],
        );

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
            'sla_days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        DB::transaction(function () use ($jobType, $data) {
            $jobType->update(['code' => strtoupper($data['code']), 'name' => $data['name'], 'is_active' => $data['is_active'] ?? true]);
            $jobType->steps()->delete();
            collect(preg_split('/\r\n|\r|\n/', $data['steps'] ?? ''))->map(fn (?string $step) => trim((string) $step))->filter()->values()->each(fn (string $step, int $index) => $jobType->steps()->create(['name' => $step, 'sort_order' => $index + 1, 'is_active' => true]));
            SlaPolicy::updateOrCreate(['job_type_id' => $jobType->id, 'branch_id' => null], ['days' => $data['sla_days'], 'is_active' => true]);
        });

        Audit::record($request, 'masters', $jobType, 'update_job_type', 'Jenis pekerjaan diperbarui.', ['after' => $jobType->load('steps')->toArray()]);
        return back()->with('success', 'Jenis pekerjaan diperbarui.');
    }
}
