#version 300 es
precision mediump float;

layout(location=0) in vec3 pos;
layout(location=1) in vec3 vel;
out vec3 newPos;

uniform float deltaTime;

void main(){
    newPos = pos + vel * deltaTime;
}