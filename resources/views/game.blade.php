<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="description" content="Night Market Run: a maze chase arcade game. A street cat races through a hawker night market eating every satay stick while four rival cats give chase. A new market every level, a daily course for everyone, and a world leaderboard.">
        <meta name="theme-color" content="#07040f">
        <link rel="icon" href="{{ asset('icon.svg') }}" type="image/svg+xml">
        <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">

        <title>{{ config('app.name', 'Night Market Run') }}</title>

        @fonts
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="bg-night text-arcade-white font-arcade antialiased">
        <main class="mx-auto flex h-dvh max-w-3xl flex-col gap-2 px-3 py-3 select-none">
            <h1 class="sr-only">{{ config('app.name', 'Night Market Run') }}</h1>

            <nav class="flex min-h-9 items-center justify-between gap-3 text-[9px] sm:text-[10px]" aria-label="Account">
                <a href="https://nikniq.com" class="text-arcade-dim hover:text-arcade-yellow focus-visible:outline-2 focus-visible:outline-arcade-yellow">NIKNIQ.COM</a>
                <div class="flex items-center gap-2">
                    @if (session('status'))
                        <span class="text-arcade-dim" role="status">{{ strtoupper(session('status')) }}</span>
                    @endif
                    @if (session('error'))
                        <span class="text-arcade-red" role="alert">{{ strtoupper(session('error')) }}</span>
                    @endif
                    @auth
                        <span class="truncate text-arcade-white" title="{{ auth()->user()->email }}">{{ strtoupper(auth()->user()->name) }}</span>
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="arcade-button">SIGN OUT</button>
                        </form>
                    @else
                        <x-google-button label="SIGN IN" />
                    @endauth
                </div>
            </nav>

            <header class="grid grid-cols-3 items-end text-[10px] leading-tight sm:text-xs">
                <div>
                    <div class="text-arcade-red">1UP</div>
                    <div id="score" aria-label="Score">0</div>
                </div>
                <div class="text-center">
                    <div class="text-arcade-red">HIGH SCORE</div>
                    <div id="high-score" aria-label="High score">0</div>
                </div>
                <div class="text-right">
                    <div class="text-arcade-red">MARKET</div>
                    <div id="level" aria-label="Level">1</div>
                </div>
            </header>

            <div id="stage" class="relative flex min-h-0 flex-1 touch-none items-center justify-center">
                <canvas id="game" class="block" role="img" aria-label="Night market maze. Use the arrow keys or swipe to move."></canvas>

                <section id="board" class="absolute inset-0 m-auto hidden h-fit max-h-full w-[min(92%,22rem)] overflow-auto border-2 border-arcade-blue bg-night/95 p-4 text-[10px] leading-relaxed sm:text-xs" aria-labelledby="board-title" hidden>
                    <div class="mb-3 flex items-center justify-between gap-2">
                        <h2 id="board-title" class="text-arcade-red">TOP 10</h2>
                        <button id="board-close" type="button" class="arcade-button" aria-label="Close leaderboard">X</button>
                    </div>
                    <div class="mb-3 flex gap-2" role="tablist" aria-label="Leaderboard">
                        <button type="button" class="board-tab" role="tab" data-board="classic" aria-selected="true">WORLD</button>
                        <button type="button" class="board-tab" role="tab" data-board="daily" aria-selected="false">TODAY'S RUN</button>
                    </div>
                    <p id="board-status" class="mb-2 min-h-4 text-arcade-yellow" role="status"></p>
                    <ol id="board-list" class="space-y-1 text-arcade-white"></ol>
                    <p id="board-empty" class="text-arcade-dim">NO SCORES YET. BE THE FIRST!</p>
                    @guest
                        <p class="mt-3 text-arcade-dim">SIGN IN WITH GOOGLE TO SAVE YOUR SCORES.</p>
                    @endguest
                </section>
            </div>

            <footer class="flex items-center justify-between gap-3 text-[9px] sm:text-[10px]">
                <div class="flex min-h-5 items-center gap-3">
                    <div id="lives" class="flex items-center gap-1.5" role="img" aria-label="2 spare lives"></div>
                    <canvas id="fruits" class="block" role="img" aria-label="Bonus snack"></canvas>
                    <div id="power-up" class="flex items-center gap-1 text-arcade-dim" hidden>
                        <canvas class="block" aria-hidden="true"></canvas>
                        <span id="power-up-label"></span>
                    </div>
                </div>
                <p class="hidden text-center text-[8px] leading-relaxed text-arcade-dim md:block">ARROWS · P PAUSE · M SOUND<br>TAB + IJKL · PLAYER 2</p>
                <div class="flex gap-2">
                    <button id="daily" type="button" class="arcade-button" aria-disabled="false">DAILY</button>
                    <button id="scores" type="button" class="arcade-button" aria-expanded="false" aria-controls="board">SCORES</button>
                    <button id="pause" type="button" class="arcade-button" aria-pressed="false">PAUSE</button>
                    <button id="mute" type="button" class="arcade-button whitespace-nowrap" aria-pressed="true">SOUND ON</button>
                </div>
            </footer>
        </main>

        <script>
            window.NIGHT_MARKET_CONFIG = {{ Js::from([
                'player' => auth()->user()?->only('name'),
                'csrf' => csrf_token(),
                'scoresUrl' => route('scores.index'),
                'submitUrl' => auth()->check() ? route('scores.store') : null,
                'today' => \App\Models\Score::today(),
                'dailyPlayed' => auth()->check() && auth()->user()->scores()->whereDate('day', \App\Models\Score::today())->exists(),
            ]) }};
        </script>

        <noscript>
            <p class="p-6 text-center text-xs">Night Market Run needs JavaScript to run.</p>
        </noscript>
    </body>
</html>
