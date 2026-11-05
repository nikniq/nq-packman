<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="description" content="Packman: a maze chase arcade game. Eat every dot, dodge four ghosts, and turn the tables with power pellets.">
        <meta name="theme-color" content="#000000">
        <link rel="icon" href="{{ asset('icon.svg') }}" type="image/svg+xml">
        <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">

        <title>{{ config('app.name', 'Packman') }}</title>

        @fonts
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body class="bg-black text-arcade-white font-arcade antialiased">
        <main class="mx-auto flex h-dvh max-w-3xl flex-col gap-2 px-3 py-3 select-none">
            <h1 class="sr-only">{{ config('app.name', 'Packman') }}</h1>

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
                    <div class="text-arcade-red">LEVEL</div>
                    <div id="level" aria-label="Level">1</div>
                </div>
            </header>

            <div id="stage" class="flex min-h-0 flex-1 touch-none items-center justify-center">
                <canvas id="game" class="block" role="img" aria-label="Packman maze. Use the arrow keys or swipe to move."></canvas>
            </div>

            <footer class="flex items-center justify-between gap-3 text-[9px] sm:text-[10px]">
                <div class="flex min-h-5 items-center gap-3">
                    <div id="lives" class="flex items-center gap-1.5" role="img" aria-label="2 spare lives"></div>
                    <canvas id="fruits" class="block" role="img" aria-label="Bonus fruit"></canvas>
                </div>
                <p class="hidden text-center leading-relaxed text-arcade-dim md:block">ARROWS, WASD OR GAMEPAD · P PAUSE · M SOUND</p>
                <div class="flex gap-2">
                    <button id="pause" type="button" class="arcade-button" aria-pressed="false">PAUSE</button>
                    <button id="mute" type="button" class="arcade-button" aria-pressed="true">SOUND ON</button>
                </div>
            </footer>
        </main>

        <noscript>
            <p class="p-6 text-center text-xs">Packman needs JavaScript to run.</p>
        </noscript>
    </body>
</html>
