<?php

return [
    'enabled' => (bool) env('UAT_MODE', false),
    'emergency_only' => (bool) env('UAT_EMERGENCY_ONLY', false),
];
