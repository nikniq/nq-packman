<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // A real game lasts minutes, so a handful of submissions a minute is
        // plenty and blunts scripted score flooding.
        RateLimiter::for('scores', function (Request $request) {
            return Limit::perMinute(6)->by('user:'.$request->user()?->id);
        });
    }
}
