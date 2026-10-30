<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/system-settings/index', ['settings' => [
            'early_warning_enabled' => (bool) ((int) SystemSetting::value('early_warning_enabled', 1)),
            'notification_poll_interval' => (int) SystemSetting::value('notification_poll_interval', 15),
            'sound_priority' => SystemSetting::value('sound_priority', 'important'),
            'quiet_hours_enabled' => (bool) ((int) SystemSetting::value('quiet_hours_enabled', 0)),
            'quiet_start' => SystemSetting::value('quiet_start', '22:00'),
            'quiet_end' => SystemSetting::value('quiet_end', '06:00'),
        ]]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'early_warning_enabled' => ['boolean'],
            'notification_poll_interval' => ['required', 'integer', 'in:10,15,30,60'],
            'sound_priority' => ['required', 'in:important,critical'],
            'quiet_hours_enabled' => ['boolean'],
            'quiet_start' => ['required', 'date_format:H:i'],
            'quiet_end' => ['required', 'date_format:H:i'],
        ]);
        foreach ($data as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? (int) $value : $value, 'updated_by' => $request->user()->id]);
        }

        return back()->with('success', 'Pengaturan sistem disimpan.');
    }
}
