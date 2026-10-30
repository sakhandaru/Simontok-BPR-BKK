<?php

use App\Http\Controllers\Simontok\AuditLogController;
use App\Http\Controllers\Simontok\AnnouncementController;
use App\Http\Controllers\Simontok\BranchController;
use App\Http\Controllers\Simontok\BranchMonitoringController;
use App\Http\Controllers\Simontok\CovernoteController;
use App\Http\Controllers\Simontok\DocumentArchiveController;
use App\Http\Controllers\Simontok\DocumentRequestController;
use App\Http\Controllers\Simontok\DashboardController;
use App\Http\Controllers\Simontok\JobTypeController;
use App\Http\Controllers\Simontok\NotaryController;
use App\Http\Controllers\Simontok\NotaryPortalController;
use App\Http\Controllers\Simontok\NotificationController;
use App\Http\Controllers\Simontok\OrderController;
use App\Http\Controllers\Simontok\OrderDocumentController;
use App\Http\Controllers\Simontok\OrderHandoverController;
use App\Http\Controllers\Simontok\OrderTrackingController;
use App\Http\Controllers\Simontok\PaymentRequestController;
use App\Http\Controllers\Simontok\ReportController;
use App\Http\Controllers\Simontok\RoleController;
use App\Http\Controllers\Simontok\UserController;
use App\Http\Controllers\Simontok\SystemSettingController;
use App\Http\Controllers\Simontok\WorkQueueController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check() ? to_route('dashboard') : to_route('login');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::middleware('permission:dashboard.view')->group(function () {
        Route::get('dashboard', DashboardController::class)->name('dashboard');
    });
    Route::middleware('permission:tracking.view')->group(function () {
        Route::get('tracking-orders', [OrderTrackingController::class, 'index'])->name('tracking-orders.index');
        Route::get('tracking-orders/{order}', [OrderTrackingController::class, 'show'])->name('tracking-orders.show');
    });
    Route::middleware('permission:orders.manage')->group(function () {
    Route::post('orders/{order}/submit-approval', [OrderController::class, 'submitForApproval'])->name('orders.submit-approval');
    Route::patch('orders/{order}/checklists', [OrderController::class, 'updateChecklist'])->name('orders.checklists.update');
    Route::post('orders/{order}/documents', [OrderDocumentController::class, 'store'])->name('orders.documents.store');
    Route::post('orders/{order}/documents/batch', [OrderDocumentController::class, 'storeBatch'])->name('orders.documents.batch');
    Route::patch('orders/{order}/documents/{document}', [OrderDocumentController::class, 'update'])->name('orders.documents.update');
    Route::delete('orders/{order}/documents/{document}', [OrderDocumentController::class, 'destroy'])->name('orders.documents.destroy');
    });
    Route::middleware('permission:documents.validate')->post('orders/{order}/documents/{document}/validate-final', [OrderDocumentController::class, 'validateFinal'])->name('orders.documents.validate-final');
    Route::middleware('permission:documents.validate')->post('orders/{order}/documents/validate-final-batch', [OrderDocumentController::class, 'validateFinalBatch'])->name('orders.documents.validate-final-batch');
    Route::middleware('permission:documents.validate')->post('orders/{order}/documents/{document}/return-final-revision', [OrderDocumentController::class, 'returnFinalRevision'])->name('orders.documents.return-final-revision');
    Route::middleware('permission:handovers.manage')->post('orders/{order}/handovers', [OrderHandoverController::class, 'store'])->name('orders.handovers.store');
    Route::middleware('permission:payments.verify')->post('orders/{order}/payment-requests/{paymentRequest}/verify', [PaymentRequestController::class, 'verify'])->name('orders.payment-requests.verify');
    Route::middleware('permission:payments.approve')->post('orders/{order}/payment-requests/{paymentRequest}/approve', [PaymentRequestController::class, 'approve'])->name('orders.payment-requests.approve');
    Route::middleware('permission:payments.pay')->post('orders/{order}/payment-requests/{paymentRequest}/pay', [PaymentRequestController::class, 'pay'])->name('orders.payment-requests.pay');
    Route::middleware('permission:covernotes.manage')->group(function () {
        Route::post('orders/{order}/covernotes/refresh-risk', [CovernoteController::class, 'refreshRisk'])->name('orders.covernotes.refresh-risk');
        Route::post('orders/{order}/collaterals/{collateral}/covernote-extensions', [CovernoteController::class, 'extend'])->name('orders.collaterals.covernote-extensions.store');
    });
    Route::middleware('permission:orders.approve')->post('orders/{order}/approve', [OrderController::class, 'approve'])->name('orders.approve');
    Route::middleware('permission:orders.approve')->post('orders/{order}/return-revision', [OrderController::class, 'returnForRevision'])->name('orders.return-revision');
    Route::middleware('permission:orders.cancel')->post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');
    Route::middleware('permission:orders.manage')->post('orders/{order}/reassign-notary', [OrderController::class, 'reassignNotary'])->name('orders.reassign-notary');
    Route::middleware('permission:orders.manage')->post('orders/{order}/close', [OrderController::class, 'close'])->name('orders.close');
    Route::middleware('permission:orders.create')->group(function () {
        Route::resource('orders', OrderController::class)->only(['create', 'store']);
    });
    Route::middleware('permission:orders.view')->group(function () {
        Route::resource('orders', OrderController::class)->only(['index', 'show']);
        Route::get('orders/{order}/documents/{document}/download', [OrderDocumentController::class, 'download'])->name('orders.documents.download');
        Route::get('orders/{order}/documents/{document}/preview', [OrderDocumentController::class, 'preview'])->name('orders.documents.preview');
        Route::get('orders/{order}/collaterals/{collateral}/covernote/preview', [CovernoteController::class, 'preview'])->name('orders.collaterals.covernote.preview');
        Route::get('orders/{order}/collaterals/{collateral}/covernote-extensions/{extension}/preview', [CovernoteController::class, 'previewExtension'])->name('orders.collaterals.covernote-extensions.preview');
        Route::get('orders/{order}/payment-requests/{paymentRequest}/payments/{payment}/download', [PaymentRequestController::class, 'downloadProof'])->name('orders.payment-requests.payments.download');
    });
    Route::post('notary/orders/{order}/document-requests', [DocumentRequestController::class, 'store'])->middleware('permission:notary.actions')->name('notary.orders.document-requests.store');
    Route::post('orders/{order}/document-requests/{documentRequest}/fulfill', [DocumentRequestController::class, 'fulfill'])->middleware('permission:orders.manage')->name('orders.document-requests.fulfill');
    Route::middleware('permission:orders.manage')->group(function () {
        Route::resource('orders', OrderController::class)->only(['edit', 'update']);
    });
    Route::middleware('permission:reports.view')->get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::middleware('permission:orders.view')->get('work-queue', WorkQueueController::class)->name('work-queue.index');
    Route::middleware('permission:branches.monitor')->get('branch-monitoring', BranchMonitoringController::class)->name('branch-monitoring.index');
    Route::middleware('permission:system.settings')->group(function () {
        Route::get('system-settings', [SystemSettingController::class, 'index'])->name('system-settings.index');
        Route::put('system-settings', [SystemSettingController::class, 'update'])->name('system-settings.update');
    });
    Route::middleware('permission:audit.view')->get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
    Route::get('notifications/poll', [NotificationController::class, 'poll'])->name('notifications.poll');
    Route::post('notifications/{notification}/open', [NotificationController::class, 'markOpened'])->name('notifications.open');
    Route::middleware('permission:announcements.manage')->group(function () {
        Route::get('announcements', [AnnouncementController::class, 'index'])->name('announcements.index');
        Route::post('announcements', [AnnouncementController::class, 'store'])->name('announcements.store');
        Route::put('announcements/{announcement}', [AnnouncementController::class, 'update'])->name('announcements.update');
    });
    Route::post('announcements/{announcement}/read', [AnnouncementController::class, 'markRead'])->name('announcements.read');
    Route::middleware('permission:notary.portal')->group(function () {
        Route::get('notary/orders', [NotaryPortalController::class, 'index'])->name('notary.orders.index');
        Route::get('notary/orders/{order}', [NotaryPortalController::class, 'show'])->name('notary.orders.show');
        Route::get('notary/orders/{order}/agreement/preview', [NotaryPortalController::class, 'agreementPreview'])->name('notary.orders.agreement.preview');
        Route::middleware('permission:notary.actions')->group(function () {
            Route::post('notary/orders/{order}/accept-documents', [NotaryPortalController::class, 'acceptDocuments'])->name('notary.orders.accept-documents');
            Route::post('notary/orders/{order}/agreement/acknowledge', [NotaryPortalController::class, 'acknowledgeAgreement'])->name('notary.orders.agreement.acknowledge');
            Route::put('notary/orders/{order}/step-fees', [NotaryPortalController::class, 'saveStepFees'])->name('notary.orders.step-fees.update');
            Route::post('notary/orders/{order}/covernote', [NotaryPortalController::class, 'submitCovernote'])->name('notary.orders.covernote.store');
            Route::post('notary/orders/{order}/request-revision', [NotaryPortalController::class, 'requestRevision'])->name('notary.orders.request-revision');
            Route::post('notary/orders/{order}/reject', [NotaryPortalController::class, 'reject'])->name('notary.orders.reject');
            Route::post('notary/orders/{order}/progress', [NotaryPortalController::class, 'storeProgress'])->name('notary.orders.progress.store');
            Route::post('notary/orders/{order}/documents', [OrderDocumentController::class, 'store'])->name('notary.orders.documents.store');
            Route::post('notary/orders/{order}/documents/submit-final', [OrderDocumentController::class, 'submitFinal'])->name('notary.orders.documents.submit-final');
            Route::post('notary/orders/{order}/payment-requests', [PaymentRequestController::class, 'store'])->name('notary.orders.payment-requests.store');
            Route::post('notary/orders/{order}/collaterals/{collateral}/covernote-extensions', [CovernoteController::class, 'extend'])->name('notary.orders.collaterals.covernote-extensions.store');
        });
        Route::get('notary/orders/{order}/documents/{document}/download', [OrderDocumentController::class, 'download'])->name('notary.orders.documents.download');
        Route::get('notary/orders/{order}/documents/{document}/preview', [OrderDocumentController::class, 'preview'])->name('notary.orders.documents.preview');
        Route::get('notary/orders/{order}/progress/{progress}/evidence', [NotaryPortalController::class, 'progressEvidence'])->name('notary.orders.progress.evidence');
        Route::get('notary/orders/{order}/payment-requests/{paymentRequest}/payments/{payment}/download', [PaymentRequestController::class, 'downloadProof'])->name('notary.orders.payment-requests.payments.download');
    });
    Route::middleware('permission:covernotes.approve')->group(function () {
        Route::post('orders/{order}/covernote/approve', [NotaryPortalController::class, 'approveCovernote'])->name('orders.covernote.approve');
        Route::post('orders/{order}/covernote/revision', [NotaryPortalController::class, 'requestCovernoteRevision'])->name('orders.covernote.revision');
        Route::post('orders/{order}/covernote/escalate', [NotaryPortalController::class, 'escalateCovernote'])->name('orders.covernote.escalate');
        Route::post('orders/{order}/collaterals/{collateral}/covernote-extensions/{extension}/approve', [CovernoteController::class, 'approveExtension'])->name('orders.collaterals.covernote-extensions.approve');
        Route::post('orders/{order}/collaterals/{collateral}/covernote-extensions/{extension}/reject', [CovernoteController::class, 'rejectExtension'])->name('orders.collaterals.covernote-extensions.reject');
    });
    Route::middleware('permission:documents.archive.view')->group(function () {
        Route::get('document-archives', [DocumentArchiveController::class, 'index'])->name('document-archives.index');
        Route::get('document-archives/{version}/preview', [DocumentArchiveController::class, 'preview'])->name('document-archives.preview');
        Route::get('document-archives/{version}/download', [DocumentArchiveController::class, 'download'])->name('document-archives.download');
        Route::get('document-archives/{version}/versions', [DocumentArchiveController::class, 'versions'])->name('document-archives.versions');
    });
    Route::middleware('permission:branches.manage')->group(function () {
        Route::resource('branches', BranchController::class)->only(['index', 'store', 'update']);
        Route::post('branches/{branch}/internal-account', [BranchController::class, 'createInternalAccount'])->name('branches.internal-account.store');
        Route::put('branches/{branch}/internal-account/{user}', [BranchController::class, 'updateInternalAccount'])->name('branches.internal-account.update');
    });
    Route::middleware('permission:notaries.manage')->group(function () {
        Route::resource('notaries', NotaryController::class)->only(['index', 'store', 'update']);
        Route::post('notaries/{notary}/portal-account', [NotaryController::class, 'createPortalAccount'])->name('notaries.portal-account.store');
        Route::put('notaries/{notary}/portal-account/{user}', [NotaryController::class, 'updatePortalAccount'])->name('notaries.portal-account.update');
        Route::get('notaries/{notary}/agreement/preview', [NotaryController::class, 'previewAgreement'])->name('notaries.agreement.preview');
    });
    Route::middleware('permission:job_types.manage')->group(function () {
        Route::resource('job-types', JobTypeController::class)->only(['index', 'store', 'update']);
    });
    Route::middleware('permission:users.manage')->group(function () { Route::resource('users', UserController::class)->only(['index', 'store', 'update']); });
    Route::middleware('permission:roles.manage')->group(function () { Route::resource('roles', RoleController::class)->only(['index', 'store', 'update']); });
});

require __DIR__.'/settings.php';
