<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('simontok:refresh-tracking --notify')->dailyAt('07:00');
Schedule::command('core:sync-staging')->hourly();
Schedule::command('simontok:sync-branches')->dailyAt('06:00');
Schedule::command('simontok:cleanup-temporary-documents')->dailyAt('02:30');
