<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use GuzzleHttp\Exception\ClientException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

/**
 * Sign up or sign in with Google, the only way to get an account.
 */
class GoogleController extends Controller
{
    public function redirect(): SymfonyRedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    /**
     * Google has confirmed the address, so a new account is created already
     * verified. An existing account with the same address is linked only when
     * Google reports that address as verified; otherwise anyone who added the
     * address to an unverified Google account could take the account over.
     */
    public function callback(Request $request): RedirectResponse
    {
        if ($request->filled('error')) {
            return $this->failed('Google sign-in was cancelled.');
        }

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (InvalidStateException|ClientException) {
            return $this->failed('Google sign-in was interrupted. Please try again.');
        }

        $email = Str::lower((string) $googleUser->getEmail());
        $emailVerified = filter_var($googleUser->getRaw()['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($email === '' || ! $emailVerified) {
            return $this->failed('Your Google account does not have a verified email address.');
        }

        $user = User::firstWhere('google_id', $googleUser->getId())
            ?? User::firstWhere('email', $email)
            ?? new User([
                'name' => Str::limit($googleUser->getName() ?: Str::before($email, '@'), 50, ''),
                'email' => $email,
            ]);

        $user->forceFill([
            'google_id' => $user->google_id ?? $googleUser->getId(),
            'avatar' => $user->avatar ?? $googleUser->getAvatar(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->route('home')->with('status', 'Signed in as '.$user->name.'.');
    }

    private function failed(string $message): RedirectResponse
    {
        return redirect()->route('home')->with('error', $message);
    }
}
