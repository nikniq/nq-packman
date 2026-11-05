<?php

namespace Tests\Feature;

use Tests\TestCase;

class GameTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    public function test_home_page_serves_the_game(): void
    {
        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertViewIs('game');
        $response->assertSee('<canvas id="game"', false);
    }

    public function test_home_page_has_the_hud_and_controls(): void
    {
        $response = $this->get('/');

        foreach (['score', 'high-score', 'level', 'lives', 'fruits', 'pause', 'mute', 'stage'] as $id) {
            $response->assertSee('id="'.$id.'"', false);
        }
    }

    public function test_home_page_links_the_icon_and_web_manifest(): void
    {
        $response = $this->get('/');

        $response->assertSee('icon.svg', false);
        $response->assertSee('manifest.webmanifest', false);
        $this->assertFileExists(public_path('icon.svg'));
        $this->assertJson(file_get_contents(public_path('manifest.webmanifest')));
    }

    public function test_page_title_uses_the_app_name(): void
    {
        config(['app.name' => 'Packman']);

        $this->get('/')->assertSee('<title>Packman</title>', false);
    }
}
