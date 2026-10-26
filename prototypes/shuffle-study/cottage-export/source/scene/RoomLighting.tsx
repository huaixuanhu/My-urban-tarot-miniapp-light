import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, SoftShadows } from '@react-three/drei';
import { Color } from 'three';
import type { AmbientLight, DirectionalLight, HemisphereLight } from 'three';
import { FIXED_DAYLIGHT } from '../core/daylight';
import type { DaylightPalette } from '../core/daylight';

export function RoomLighting({palette, reducedMotion}: {palette: DaylightPalette; reducedMotion: boolean}) {
  const background = useRef<Color>(null);
  const ambient = useRef<AmbientLight>(null), hemisphere = useRef<HemisphereLight>(null);
  const keyLight = useRef<DirectionalLight>(null), fill = useRef<DirectionalLight>(null);
  const colors = useMemo(() => ({
    background: new Color(palette.background), ambient: new Color(palette.ambientColor),
    sky: new Color(palette.skyColor), ground: new Color(palette.groundColor),
    key: new Color(palette.keyColor), fill: new Color(palette.fillColor),
  }), [palette]);
  useFrame((_, dt) => {
    const blend = reducedMotion ? 1 : 1 - Math.exp(-2.8 * Math.min(dt, .1));
    background.current?.lerp(colors.background, blend);
    const lights = [ambient.current, hemisphere.current, keyLight.current, fill.current];
    const targets = [palette.ambientIntensity, palette.hemisphereIntensity, palette.keyIntensity, palette.fillIntensity];
    lights.forEach((light, index) => {if (light) light.intensity += (targets[index] - light.intensity) * blend;});
    ambient.current?.color.lerp(colors.ambient, blend);
    hemisphere.current?.color.lerp(colors.sky, blend);
    hemisphere.current?.groundColor.lerp(colors.ground, blend);
    keyLight.current?.color.lerp(colors.key, blend);
    fill.current?.color.lerp(colors.fill, blend);
  });
  return <>
    <color ref={background} attach="background" args={[FIXED_DAYLIGHT.background]}/>
    <ambientLight ref={ambient} intensity={FIXED_DAYLIGHT.ambientIntensity} color={FIXED_DAYLIGHT.ambientColor}/>
    <hemisphereLight ref={hemisphere} args={[FIXED_DAYLIGHT.skyColor, FIXED_DAYLIGHT.groundColor, FIXED_DAYLIGHT.hemisphereIntensity]}/>
    <directionalLight ref={keyLight} position={[-3,8,-5]} intensity={FIXED_DAYLIGHT.keyIntensity} color={FIXED_DAYLIGHT.keyColor} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-near={.5} shadow-camera-far={30} shadow-normalBias={.025} shadow-bias={-.0002}/>
    <directionalLight ref={fill} position={[6,6,6]} intensity={FIXED_DAYLIGHT.fillIntensity} color={FIXED_DAYLIGHT.fillColor}/>
    <SoftShadows size={18} samples={12} focus={.3}/>
    {/* A stable warm indoor reflection keeps clothing readable at night. Capture once. */}
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={.65} position={[0,4,0]} rotation={[Math.PI/2,0,0]} scale={[12,12,1]} color="#fff4e4"/>
      <Lightformer intensity={.9} position={[0,2,-5]} scale={[10,4,1]} color="#ffe6bf"/>
    </Environment>
  </>;
}
