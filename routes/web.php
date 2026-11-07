<?php

use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\ScoreController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'game')->name('home');

Route::get('/scores', [ScoreController::class, 'index'])->name('scores.index');

Route::middleware('guest')->group(function () {
    Route::get('/auth/google', [GoogleController::class, 'redirect'])->name('google.redirect');
    Route::get('/auth/google/callback', [GoogleController::class, 'callback'])->name('google.callback');
});

Route::middleware('auth')->group(function () {
    Route::post('/scores', [ScoreController::class, 'store'])->middleware('throttle:scores')->name('scores.store');
    Route::post('/logout', [SessionController::class, 'destroy'])->name('logout');
});
