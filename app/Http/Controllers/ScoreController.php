<?php

namespace App\Http\Controllers;

use App\Http\Resources\ScoreResource;
use App\Models\Score;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The world leaderboard. Anyone can read it; only signed-in players add to it.
 */
class ScoreController extends Controller
{
    public const BOARD_SIZE = 10;

    public function index(): AnonymousResourceCollection
    {
        return ScoreResource::collection(
            Score::with('user')->orderByDesc('score')->oldest()->limit(self::BOARD_SIZE)->get()
        );
    }

    /**
     * Scores come from the browser, so values are bounded to what a real game
     * can produce; the route is also rate limited.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:10000000'],
            'level' => ['required', 'integer', 'min:1', 'max:999'],
        ]);

        $score = $request->user()->scores()->create($validated);

        return response()->json([
            'rank' => $score->rank(),
            'best' => (int) $request->user()->scores()->max('score'),
        ], 201);
    }
}
