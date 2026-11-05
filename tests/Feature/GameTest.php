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

        foreach (['score', 'high-score', 'level', 'lives', 'pause', 'mute', 'stage'] as $id) {
            $response->assertSee('id="'.$id.'"', false);
        }
    }

    public function test_page_title_uses_the_app_name(): void
    {
        config(['app.name' => 'Packman']);

        $this->get('/')->assertSee('<title>Packman</title>', false);
    }
}
