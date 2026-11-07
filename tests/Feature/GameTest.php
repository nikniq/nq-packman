<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class GameTest extends TestCase
{
    use LazilyRefreshDatabase;

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

        foreach (['score', 'high-score', 'level', 'lives', 'fruits', 'power-up', 'daily', 'scores', 'board', 'pause', 'mute', 'stage'] as $id) {
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

    public function test_home_page_links_to_nikniq(): void
    {
        $this->get('/')->assertSee('href="https://nikniq.com"', false);
    }

    public function test_google_sign_in_is_offered_only_when_configured(): void
    {
        config(['services.google.client_id' => null]);
        $this->get('/')->assertDontSee(route('google.redirect'));

        config(['services.google.client_id' => 'client']);
        $this->get('/')->assertSee(route('google.redirect'))->assertSee('\\u0022submitUrl\\u0022:null', false);
    }

    public function test_signed_in_players_see_their_name_and_can_sign_out(): void
    {
        $user = User::factory()->create(['name' => 'Ace Player']);

        $response = $this->actingAs($user)->get('/');

        $response->assertSee('ACE PLAYER');
        $response->assertSee(route('logout'));
        $response->assertSee('\\u0022submitUrl\\u0022:\\u0022http', false);
    }

    public function test_page_title_uses_the_app_name(): void
    {
        config(['app.name' => 'Night Market Run']);

        $this->get('/')->assertSee('<title>Night Market Run</title>', false);
    }
}
