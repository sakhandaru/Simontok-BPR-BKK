<?php

return [
    'enabled' => (bool) env('UAT_MODE', false),
    'emergency_only' => (bool) env('UAT_EMERGENCY_ONLY', false),
    'document_checklist_bypass' => (bool) env('UAT_DOCUMENT_CHECKLIST_BYPASS', env('UAT_MODE', false)),
];
