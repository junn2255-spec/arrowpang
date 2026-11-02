바닷가 별장 분리 레이어 v2
beach-base: 파도 거품과 야자수를 제거한 기본 바다+모래사장.
palm-foreground: 동일 세로 캔버스 위치에 놓는 투명 야자수 레이어. 갈매기보다 나중에 그려 잎 뒤로 가려집니다.
swash: 8프레임 4열2행, 각768x256. 얕게 밀려오는 물막, 최대로 퍼짐, 빠짐 순서.
기본배경→물결→파도→갈매기→야자수 순서. preview.html 확인용, 실제게임 미적용.
Built-in image_gen used. Prompts: remove baked-in foam and tree from base while preserving composition; transparent palm cutout registered to full canvas; 8 stages of shallow white-rim shoreline wash, no raised waves.

v3: sunlight-atlas 8 frames,128x128,4x2. Built-in imagegen: thin white/cyan sunlight glint, rise and fade cycle, transparent. Preview adds sea-only row distortion,12 crossfaded ripple patches and staggered sunlight glints. Horizon and sand stay fixed.
