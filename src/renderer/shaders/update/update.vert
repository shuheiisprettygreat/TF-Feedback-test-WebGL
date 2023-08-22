#version 300 es
precision mediump float;

in vec3 vel;
in vec3 pos;
out vec3 newPos;

uniform float deltaTime;

void main(){
    newPos = pos + vel * deltaTime;
}