export const VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform vec2 u_offset;
  uniform float u_scale;
  uniform float u_rotation;
  uniform vec2 u_rotationCenter;

  void main() {

    vec2 pos = a_position + u_offset - u_rotationCenter;
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotated = vec2(
      pos.x * cosR - pos.y * sinR,
      pos.x * sinR + pos.y * cosR
    );
    pos = rotated + u_rotationCenter;

    vec2 position = ((pos * u_scale) + u_translation) / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(position * vec2(1, -1), 0, 1);
  }
`;

export const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;

export const GRID_VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0, 1);
  }
`;

export const GRID_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;
  uniform vec3 u_bgColor;
  uniform float u_bgVisible;

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    fragCoord.y = u_resolution.y - fragCoord.y;
    vec2 worldPos = (fragCoord - u_translation) / u_scale;

    vec3 bgColor;

    if (u_bgVisible > 0.5) {
        bgColor = u_bgColor;
    } else {

        float size = 10.0;
        vec2 p = floor(worldPos / size);
        float pattern = mod(p.x + p.y, 2.0);
        bgColor = mix(vec3(1.0), vec3(0.95), pattern);
    }

    float baseSpacing = 10.0;
    float spacing = baseSpacing;

    vec2 gridPos = mod(worldPos, spacing);
    vec2 dist = min(gridPos, spacing - gridPos);

    float lineThickness = 1.0 / u_scale;
    float lineY = smoothstep(lineThickness, 0.0, dist.y);
    float lineX = smoothstep(lineThickness, 0.0, dist.x);
    float grid = max(lineX, lineY);

    vec3 gridColor = vec3(0.92);

    if (u_bgVisible > 0.5) {
        gl_FragColor = vec4(mix(bgColor, gridColor, grid), 1.0);
    } else {
        gl_FragColor = vec4(bgColor, 1.0);
    }
  }
`;
