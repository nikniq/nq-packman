<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Accounts come from Google, so the default user has no password.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'google_id' => fake()->unique()->numerify('g-##########'),
            'avatar' => null,
            'password' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function google(string $googleId): static
    {
        return $this->state(fn (array $attributes) => ['google_id' => $googleId]);
    }

    public function withoutGoogle(): static
    {
        return $this->state(fn (array $attributes) => ['google_id' => null]);
    }
}
