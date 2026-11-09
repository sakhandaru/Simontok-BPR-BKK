<?php

namespace Tests\Feature;

use Tests\TestCase;

class PwaAssetsTest extends TestCase
{
    public function test_manifest_has_the_required_installable_icons(): void
    {
        $manifest = json_decode(
            file_get_contents(public_path('manifest.webmanifest')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $this->assertSame('SIMONTOK', $manifest['name']);
        $this->assertSame('/', $manifest['start_url']);
        $this->assertSame('/', $manifest['scope']);
        $this->assertSame('standalone', $manifest['display']);

        $expectedIcons = [
            '/icons/icon-192.png' => [192, 192, 'any'],
            '/icons/icon-512.png' => [512, 512, 'any'],
            '/icons/icon-maskable-512.png' => [512, 512, 'maskable'],
        ];

        foreach ($manifest['icons'] as $icon) {
            if (! isset($expectedIcons[$icon['src']])) {
                continue;
            }

            [$width, $height, $purpose] = $expectedIcons[$icon['src']];
            $path = public_path(ltrim($icon['src'], '/'));
            $size = getimagesize($path);

            $this->assertNotFalse($size);
            $this->assertSame($width, $size[0]);
            $this->assertSame($height, $size[1]);
            $this->assertSame($purpose, $icon['purpose']);

            unset($expectedIcons[$icon['src']]);
        }

        $this->assertSame([], $expectedIcons);
    }

    public function test_offline_shell_and_update_worker_are_present(): void
    {
        $worker = file_get_contents(public_path('sw.js'));
        $offlinePage = file_get_contents(public_path('offline.html'));

        $this->assertStringContainsString("const offlinePage = '/offline.html';", $worker);
        $this->assertStringContainsString("url.pathname.startsWith('/build/assets/')", $worker);
        $this->assertStringContainsString("event.data?.type === 'SKIP_WAITING'", $worker);
        $this->assertStringContainsString('SIMONTOK sedang offline', $offlinePage);
        $this->assertStringContainsString('Coba lagi', $offlinePage);
    }
}
