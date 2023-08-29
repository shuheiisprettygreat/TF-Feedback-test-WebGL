#version 300 es
precision mediump float;

in vec2 iTex;

uniform sampler2D depthMap;

out vec4 FragColor;

void main()
{             
    vec4 col = texture(depthMap, iTex);
    FragColor = col; 
}