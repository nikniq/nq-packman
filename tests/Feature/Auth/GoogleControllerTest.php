<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery\MockInterface;
use Tests\TestCase;

class GoogleControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
        ]);
    }

    public function test_redirect_sends_the_browser_to_google_with_the_configured_client(): void
    {
        $response = $this->get(route('google.redirect'));

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/auth?', $location);
        $this->assertStringContainsString('client_id=test-client', $location);
        $this->assertStringContainsString(urlencode(route('google.callback')), $location);
    }

    public function test_callback_creates_a_verified_account_for_a_new_google_user_and_signs_in(): void
    {
        $this->freezeSecond();
        $this->fakeGoogleUser(id: 'g-123', email: 'Player@Example.com', name: 'Ace Player', avatar: 'https://lh3.example/avatar.png');

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']));

        $response->assertRedirect(route('home'));
        $response->assertSessionHas('status', 'Signed in as Ace Player.');
        $user = User::firstWhere('email', 'player@example.com');
        $this->assertNotNull($user);
        $this->assertSame('Ace Player', $user->name);
        $this->assertSame('g-123', $user->google_id);
        $this->assertSame('https://lh3.example/avatar.png', $user->avatar);
        $this->assertTrue($user->email_verified_at->equalTo(now()));
        $this->assertNull($user->password);
        $this->assertAuthenticatedAs($user);
    }

    public function test_callback_signs_in_an_account_already_linked_to_that_google_id(): void
    {
        $user = User::factory()->google('g-123')->create(['email' => 'old@example.com']);
        $this->fakeGoogleUser(id: 'g-123', email: 'new@example.com');

        $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']))->assertRedirect(route('home'));

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseCount('users', 1);
        $this->assertSame('old@example.com', $user->fresh()->email);
    }

    public function test_callback_links_an_existing_email_account_when_google_has_verified_the_address(): void
    {
        $user = User::factory()->withoutGoogle()->create(['email' => 'player@example.com', 'name' => 'Keep Me']);
        $this->fakeGoogleUser(id: 'g-123', email: 'player@example.com', name: 'Google Name');

        $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']))->assertRedirect(route('home'));

        $this->assertAuthenticatedAs($user);
        $user->refresh();
        $this->assertSame('g-123', $user->google_id);
        $this->assertSame('Keep Me', $user->name);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_callback_refuses_an_unverified_google_address_so_accounts_cannot_be_taken_over(): void
    {
        $user = User::factory()->withoutGoogle()->create(['email' => 'player@example.com']);
        $this->fakeGoogleUser(id: 'g-123', email: 'player@example.com', verified: false);

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'xyz']));

        $response->assertRedirect(route('home'));
        $response->assertSessionHas('error');
        $this->assertGuest();
        $this->assertNull($user->fresh()->google_id);
    }

    public function test_callback_handles_a_cancelled_sign_in(): void
    {
        $response = $this->get(route('google.callback', ['error' => 'access_denied']));

        $response->assertRedirect(route('home'));
        $response->assertSessionHas('error', 'Google sign-in was cancelled.');
        $this->assertGuest();
    }

    public function test_callback_handles_an_invalid_state(): void
    {
        $this->mock(Provider::class, function (MockInterface $mock) {
            $mock->shouldReceive('user')->andThrow(new InvalidStateException);
        });
        Socialite::shouldReceive('driver')->with('google')->andReturn(app(Provider::class));

        $response = $this->get(route('google.callback', ['code' => 'abc', 'state' => 'bad']));

        $response->assertRedirect(route('home'));
        $response->assertSessionHas('error', 'Google sign-in was interrupted. Please try again.');
        $this->assertGuest();
    }

    public function test_signed_in_players_are_sent_home_instead_of_to_google(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('google.redirect'))
            ->assertRedirect('/');
    }

    public function test_signing_out_ends_the_session(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('logout'));

        $response->assertRedirect(route('home'));
        $this->assertGuest();
    }

    private function fakeGoogleUser(string $id, string $email, string $name = 'Google User', ?string $avatar = null, bool $verified = true): void
    {
        $googleUser = (new GoogleUser)->setRaw(['email_verified' => $verified])->map([
            'id' => $id,
            'email' => $email,
            'name' => $name,
            'avatar' => $avatar,
        ]);

        $this->mock(Provider::class, function (MockInterface $mock) use ($googleUser) {
            $mock->shouldReceive('user')->andReturn($googleUser);
        });
        Socialite::shouldReceive('driver')->with('google')->andReturn(app(Provider::class));
    }
}
