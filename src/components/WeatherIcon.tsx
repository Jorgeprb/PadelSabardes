import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, MoonStar, Sun } from 'lucide-react';
import { WeatherVisualKind } from '../services/weather';

type WeatherIconProps = {
  kind: WeatherVisualKind;
  isDay?: boolean;
  size?: number;
  color?: string;
};

export default function WeatherIcon({ kind, isDay = true, size = 20, color = '#f8fafc' }: WeatherIconProps) {
  switch (kind) {
    case 'clear':
      return isDay ? <Sun size={size} color={color} /> : <MoonStar size={size} color={color} />;
    case 'mostlyClear':
    case 'partlyCloudy':
      return isDay ? <CloudSun size={size} color={color} /> : <MoonStar size={size} color={color} />;
    case 'cloudy':
      return <Cloud size={size} color={color} />;
    case 'fog':
      return <CloudFog size={size} color={color} />;
    case 'drizzle':
      return <CloudDrizzle size={size} color={color} />;
    case 'rain':
    case 'showers':
      return <CloudRain size={size} color={color} />;
    case 'snow':
      return <CloudSnow size={size} color={color} />;
    case 'storm':
      return <CloudLightning size={size} color={color} />;
    default:
      return <Cloud size={size} color={color} />;
  }
}
