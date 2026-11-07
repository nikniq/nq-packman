<?php

namespace App\Http\Resources;

use App\Models\Score;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A leaderboard entry. Only the player's display name is exposed, never
 * their email address.
 *
 * @mixin Score
 */
class ScoreResource extends JsonResource
{
    /**
     * @return array{name: string, score: int, level: int}
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->user->name,
            'score' => $this->score,
            'level' => $this->level,
        ];
    }
}
