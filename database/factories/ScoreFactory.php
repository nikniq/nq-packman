<?php

namespace Database\Factories;

use App\Models\Score;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Score>
 */
class ScoreFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'score' => fake()->numberBetween(10, 50000),
            'level' => fake()->numberBetween(1, 12),
            'run' => 'classic',
            'day' => null,
        ];
    }

    /**
     * A score on today's daily run.
     */
    public function daily(?string $day = null): static
    {
        return $this->state(fn () => ['run' => 'daily', 'day' => $day ?? Score::today()]);
    }
}
