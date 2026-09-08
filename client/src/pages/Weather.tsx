import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Thermometer, MapPin, RefreshCw, Loader2, Navigation, Sunrise, Sunset, Gauge, Eye, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatTimeKR } from '../utils/timezone';

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: number;
  time: string;
  pressure: number;
  visibility: number;
  sunrise: string;
  sunset: string;
}

interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitation: number;
  sunrise: string;
  sunset: string;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
}

interface WeatherWarning {
  type: 'frost' | 'storm' | 'wind' | 'heat' | 'fog';
  severity: 'yellow' | 'orange' | 'red';
  message: string;
}

const CITIES = [
  { name: 'Норильск', lat: 69.3535, lon: 88.2027 },
  { name: 'Москва', lat: 55.7558, lon: 37.6173 },
  { name: 'Санкт-Петербург', lat: 59.9343, lon: 30.3351 },
  { name: 'Сочи', lat: 43.5855, lon: 39.7231 },
  { name: 'Казань', lat: 55.7887, lon: 49.1221 },
  { name: 'Екатеринбург', lat: 56.8389, lon: 60.6057 },
  { name: 'Новосибирск', lat: 55.0084, lon: 82.9357 },
  { name: 'Калининград', lat: 54.7065, lon: 20.5109 },
  { name: 'Владивосток', lat: 43.1332, lon: 131.9113 },
];

function getWeatherIcon(code: number, isDay: boolean = true) {
  if (code === 0) return isDay ? Sun : Cloud;
  if (code <= 3) return Cloud;
  if (code <= 49) return Cloud;
  if (code <= 59) return CloudRain;
  if (code <= 69) return CloudRain;
  if (code <= 79) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Ясно';
  if (code <= 3) return 'Облачно';
  if (code <= 49) return 'Туман';
  if (code <= 59) return 'Морось';
  if (code <= 69) return 'Дождь';
  if (code <= 79) return 'Снег';
  if (code <= 82) return 'Ливень';
  if (code <= 86) return 'Снегопад';
  if (code <= 99) return 'Гроза';
  return 'Неизвестно';
}

function getWeatherColor(code: number): string {
  if (code === 0) return '#ffd700';
  if (code <= 3) return '#87ceeb';
  if (code <= 49) return '#b0b0b0';
  if (code <= 69) return '#4a90d9';
  if (code <= 79) return '#e0e0e0';
  if (code <= 99) return '#ff6b6b';
  return '#808080';
}

function getWindDirection(degrees: number): string {
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round(degrees / 45) % 8];
}

function getWindDirectionFull(degrees: number): string {
  const dirs = ['Северный', 'Северо-Восточный', 'Восточный', 'Юго-Восточный', 'Южный', 'Юго-Западный', 'Западный', 'Северо-Западный'];
  return dirs[Math.round(degrees / 45) % 8];
}

function isRain(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
}

function isSnow(code: number): boolean {
  return (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
}

function isStorm(code: number): boolean {
  return code >= 95;
}

// Historical monthly average temperatures for cities (approximate)
const HISTORICAL_NORMS: Record<string, number[]> = {
  'Норильск': [-27, -25, -18, -10, -2, 8, 14, 12, 4, -7, -19, -25],
  'Москва': [-8, -7, -1, 7, 14, 18, 20, 18, 12, 5, -1, -6],
  'Санкт-Петербург': [-6, -5, -1, 5, 11, 16, 18, 17, 11, 5, 0, -4],
  'Сочи': [6, 6, 8, 13, 17, 21, 24, 24, 20, 15, 10, 7],
  'Казань': [-12, -10, -4, 6, 14, 19, 21, 19, 12, 4, -4, -10],
  'Екатеринбург': [-14, -12, -4, 5, 13, 18, 20, 17, 10, 3, -6, -12],
  'Новосибирск': [-16, -14, -7, 3, 12, 18, 20, 17, 10, 2, -8, -14],
  'Калининград': [-1, -1, 2, 7, 12, 16, 18, 18, 14, 9, 4, 1],
  'Владивосток': [-12, -9, -2, 5, 10, 14, 18, 20, 16, 8, -2, -10],
};

function getHistoricalNorm(cityName: string, month: number): number {
  const norms = HISTORICAL_NORMS[cityName];
  return norms ? norms[month] : 0;
}

function getWeatherWarnings(data: WeatherData, forecast: ForecastDay[]): WeatherWarning[] {
  const warnings: WeatherWarning[] = [];

  // Extreme frost
  if (data.temperature <= -35) {
    warnings.push({ type: 'frost', severity: 'red', message: `ЭКСТРЕМАЛЬНЫЙ МОРОЗ: ${Math.round(data.temperature)}°C. Опасность обморожения!` });
  } else if (data.temperature <= -25) {
    warnings.push({ type: 'frost', severity: 'orange', message: `Сильный мороз: ${Math.round(data.temperature)}°C. Одевайтесь тепло.` });
  }

  // Strong wind
  if (data.windSpeed >= 20) {
    warnings.push({ type: 'wind', severity: 'red', message: `Штормовой ветер: ${Math.round(data.windSpeed)} м/с. Не выходите без необходимости.` });
  } else if (data.windSpeed >= 15) {
    warnings.push({ type: 'wind', severity: 'orange', message: `Сильный ветер: ${Math.round(data.windSpeed)} м/с. Будьте осторожны.` });
  }

  // Storm
  if (isStorm(data.weatherCode)) {
    warnings.push({ type: 'storm', severity: 'red', message: 'ГРОЗА! Оставайтесь в помещении.' });
  }

  // Heavy snow
  if (isSnow(data.weatherCode) && data.temperature < -5) {
    warnings.push({ type: 'storm', severity: 'yellow', message: 'Снегопад. Осторожнее на дорогах.' });
  }

  // Low visibility (fog)
  if (data.visibility < 1000) {
    warnings.push({ type: 'fog', severity: 'orange', message: `Туман: видимость ${Math.round(data.visibility)}м. Аккуратнее за рулём.` });
  }

  // Tomorrow warnings
  if (forecast.length > 1) {
    const tomorrow = forecast[1];
    if (tomorrow.tempMax >= 35) {
      warnings.push({ type: 'heat', severity: 'orange', message: `Завтра жара: ${Math.round(tomorrow.tempMax)}°C. Пейте больше воды.` });
    }
    if (tomorrow.tempMin <= -40) {
      warnings.push({ type: 'frost', severity: 'red', message: `Завтра экстремальный мороз: ${Math.round(tomorrow.tempMin)}°C!` });
    }
  }

  return warnings;
}

// Weather animation component
function WeatherAnimation({ code }: { code: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; speed: number; length: number; opacity: number; wind: number }[] = [];
    const particleCount = isRain(code) ? 150 : isSnow(code) ? 100 : isStorm(code) ? 200 : 0;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: isRain(code) ? 8 + Math.random() * 6 : isSnow(code) ? 1 + Math.random() * 2 : 12 + Math.random() * 8,
        length: isRain(code) ? 15 + Math.random() * 10 : isSnow(code) ? 2 + Math.random() * 3 : 20 + Math.random() * 15,
        opacity: 0.3 + Math.random() * 0.5,
        wind: isSnow(code) ? (Math.random() - 0.5) * 2 : isStorm(code) ? 3 + Math.random() * 3 : 0,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        ctx.beginPath();
        if (isSnow(code)) {
          ctx.arc(p.x, p.y, p.length / 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        } else {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.wind, p.y + p.length);
          ctx.strokeStyle = isStorm(code)
            ? `rgba(255, 255, 200, ${p.opacity})`
            : `rgba(174, 194, 224, ${p.opacity})`;
          ctx.lineWidth = isStorm(code) ? 2 : 1;
        }
        ctx.stroke();

        p.y += p.speed;
        p.x += p.wind;

        if (p.y > canvas.height) {
          p.y = -p.length;
          p.x = Math.random() * canvas.width;
        }
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
      });

      animId = requestAnimationFrame(animate);
    };

    if (particleCount > 0) animId = requestAnimationFrame(animate);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [code]);

  if (!isRain(code) && !isSnow(code) && !isStorm(code)) return null;

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }} />
  );
}

export default function Weather() {
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [allHourlyData, setAllHourlyData] = useState<HourlyForecast[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Computed values
  const warnings = currentWeather ? getWeatherWarnings(currentWeather, forecast) : [];
  const historicalNorm = getHistoricalNorm(selectedCity.name, new Date().getMonth());
  const tempDiff = currentWeather ? Math.round(currentWeather.temperature - historicalNorm) : 0;

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,surface_pressure,visibility&daily=sunrise,sunset&timezone=auto&forecast_days=1`
      );
      const currentData = await currentRes.json();

      if (currentData.current) {
        setCurrentWeather({
          temperature: currentData.current.temperature_2m,
          humidity: currentData.current.relative_humidity_2m,
          windSpeed: currentData.current.wind_speed_10m,
          windDirection: currentData.current.wind_direction_10m,
          weatherCode: currentData.current.weather_code,
          isDay: currentData.current.is_day,
          time: currentData.current.time,
          pressure: currentData.current.surface_pressure,
          visibility: currentData.current.visibility,
          sunrise: currentData.daily?.sunrise?.[0] || '',
          sunset: currentData.daily?.sunset?.[0] || '',
        });
      }

      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,sunrise,sunset&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=auto&forecast_days=7`
      );
      const forecastData = await forecastRes.json();

      if (forecastData.daily) {
        const days: ForecastDay[] = forecastData.daily.time.map((date: string, i: number) => ({
          date,
          tempMax: forecastData.daily.temperature_2m_max[i],
          tempMin: forecastData.daily.temperature_2m_min[i],
          weatherCode: forecastData.daily.weather_code[i],
          precipitation: forecastData.daily.precipitation_sum[i],
          sunrise: forecastData.daily.sunrise?.[i] || '',
          sunset: forecastData.daily.sunset?.[i] || '',
        }));
        setForecast(days);
      }

      if (forecastData.hourly) {
        const hourly: HourlyForecast[] = forecastData.hourly.time.map((time: string, i: number) => ({
          time,
          temperature: forecastData.hourly.temperature_2m[i],
          weatherCode: forecastData.hourly.weather_code[i],
          windSpeed: forecastData.hourly.wind_speed_10m[i],
          precipitation: forecastData.hourly.precipitation[i],
        }));
        setAllHourlyData(hourly);
        setSelectedDayIndex(0);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError('Ошибка загрузки данных о погоде');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [selectedCity]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const formatHour = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.getHours().toString().padStart(2, '0') + ':00';
  };

  // Get hourly data for selected day
  const getHourlyForDay = (dayIndex: number): HourlyForecast[] => {
    if (!forecast[dayIndex]) return [];
    const dayDate = forecast[dayIndex].date;
    return allHourlyData.filter(h => h.time.startsWith(dayDate));
  };

  const selectedDayHourly = getHourlyForDay(selectedDayIndex);
  const selectedDayName = forecast[selectedDayIndex]
    ? (selectedDayIndex === 0 ? 'Сегодня' : formatDate(forecast[selectedDayIndex].date))
    : '';

  return (
    <div className="space-y-6 relative">
      {/* Weather animation */}
      {currentWeather && <WeatherAnimation code={currentWeather.weatherCode} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Cloud className="w-7 h-7 md:w-8 md:h-8" />
            ПОГОДА
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// ПРОГНОЗ ПО ГОРОДАМ РОССИИ</p>
        </div>
        <button onClick={fetchWeather} disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          ОБНОВИТЬ
        </button>
      </div>

      {/* City selector */}
      <div className="flex gap-2 flex-wrap relative z-10">
        {CITIES.map(city => (
          <motion.button key={city.name} onClick={() => setSelectedCity(city)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs transition-all"
            style={selectedCity.name === city.name
              ? { backgroundColor: 'var(--color-primary)', color: '#000', fontWeight: 'bold' }
              : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
            }>
            <MapPin className="w-3 h-3" />
            {city.name}
          </motion.button>
        ))}
      </div>

      {/* Weather warnings */}
      <AnimatePresence>
        {warnings.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-2 relative z-10">
            {warnings.map((w, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: w.severity === 'red' ? 'rgba(255,59,48,0.15)' : w.severity === 'orange' ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.08)',
                  border: `1px solid ${w.severity === 'red' ? 'rgba(255,59,48,0.3)' : w.severity === 'orange' ? 'rgba(234,179,8,0.3)' : 'rgba(234,179,8,0.2)'}`,
                }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0"
                  style={{ color: w.severity === 'red' ? '#ff3b30' : w.severity === 'orange' ? '#eab308' : '#eab308' }} />
                <span className="font-mono text-sm" style={{ color: w.severity === 'red' ? '#ff6b6b' : '#eab308' }}>
                  {w.message}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="glass rounded-xl p-4 text-center relative z-10">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      )}

      {isLoading && !currentWeather ? (
        <div className="glass rounded-xl p-12 text-center relative z-10">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
          <p className="font-mono text-sm text-gray-400">Загрузка данных...</p>
        </div>
      ) : currentWeather ? (
        <AnimatePresence mode="wait">
          <motion.div key={selectedCity.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 relative z-10">

            {/* Current weather */}
            <div className="glass rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                {/* Main info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <span className="font-mono text-sm text-gray-400">{selectedCity.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      {(() => {
                        const Icon = getWeatherIcon(currentWeather.weatherCode, currentWeather.isDay === 1);
                        return <Icon className="w-16 h-16 md:w-20 md:h-20" style={{ color: getWeatherColor(currentWeather.weatherCode) }} />;
                      })()}
                    </motion.div>
                    <div>
                      <div className="text-5xl md:text-7xl font-mono font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                        {Math.round(currentWeather.temperature)}°
                      </div>
                      <div className="font-mono text-sm text-gray-400 mt-1">
                        {getWeatherDescription(currentWeather.weatherCode)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* All details - unified grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-white/5">
                  <div className="text-center">
                    <Thermometer className="w-5 h-5 mx-auto mb-1" style={{ color: '#ff6b6b' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{Math.round(currentWeather.temperature)}°C</div>
                    <div className="font-mono text-[10px] text-gray-500">ТЕМПЕРАТУРА</div>
                  </div>
                  <div className="text-center">
                    <Droplets className="w-5 h-5 mx-auto mb-1" style={{ color: '#4a90d9' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{currentWeather.humidity}%</div>
                    <div className="font-mono text-[10px] text-gray-500">ВЛАЖНОСТЬ</div>
                  </div>
                  <div className="text-center">
                    <Wind className="w-5 h-5 mx-auto mb-1" style={{ color: '#87ceeb' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{Math.round(currentWeather.windSpeed)} м/с</div>
                    <div className="font-mono text-[10px] text-gray-500">ВЕТЕР {getWindDirection(currentWeather.windDirection)}</div>
                  </div>
                  <div className="text-center">
                    <Gauge className="w-5 h-5 mx-auto mb-1" style={{ color: '#a78bfa' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{Math.round(currentWeather.pressure * 0.75)}</div>
                    <div className="font-mono text-[10px] text-gray-500">ДАВЛЕНИЕ (мм)</div>
                  </div>
                  <div className="text-center">
                    <Eye className="w-5 h-5 mx-auto mb-1" style={{ color: '#87ceeb' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{(currentWeather.visibility / 1000).toFixed(1)} км</div>
                    <div className="font-mono text-[10px] text-gray-500">ВИДИМОСТЬ</div>
                  </div>
                </div>

                {/* Second row - sun + norm */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-white/5">
                  <div className="text-center">
                    <Sunrise className="w-5 h-5 mx-auto mb-1" style={{ color: '#ffd700' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">
                      {currentWeather.sunrise ? formatTimeKR(currentWeather.sunrise) : '--:--'}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">ВОСХОД</div>
                  </div>
                  <div className="text-center">
                    <Sunset className="w-5 h-5 mx-auto mb-1" style={{ color: '#ff6b6b' }} />
                    <div className="font-mono text-lg font-bold text-gray-200">
                      {currentWeather.sunset ? formatTimeKR(currentWeather.sunset) : '--:--'}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">ЗАКАТ</div>
                  </div>
                  <div className="text-center">
                    <Navigation className="w-5 h-5 mx-auto mb-1" style={{ color: '#eab308', transform: `rotate(${currentWeather.windDirection}deg)` }} />
                    <div className="font-mono text-lg font-bold text-gray-200">{getWindDirectionFull(currentWeather.windDirection)}</div>
                    <div className="font-mono text-[10px] text-gray-500">НАПРАВЛЕНИЕ</div>
                  </div>
                  <div className="text-center">
                    {tempDiff > 0 ? <TrendingUp className="w-5 h-5 mx-auto mb-1" style={{ color: '#ff6b6b' }} /> : tempDiff < 0 ? <TrendingDown className="w-5 h-5 mx-auto mb-1" style={{ color: '#4a90d9' }} /> : <Minus className="w-5 h-5 mx-auto mb-1 text-gray-500" />}
                    <div className="font-mono text-lg font-bold text-gray-200">{historicalNorm > 0 ? '+' : ''}{historicalNorm}°C</div>
                    <div className="font-mono text-[10px] text-gray-500">НОРМА</div>
                  </div>
                  <div className="text-center">
                    <Thermometer className="w-5 h-5 mx-auto mb-1" style={{ color: tempDiff > 0 ? '#ff6b6b' : tempDiff < 0 ? '#4a90d9' : '#6b7280' }} />
                    <div className="font-mono text-lg font-bold" style={{ color: tempDiff > 0 ? '#ff6b6b' : tempDiff < 0 ? '#4a90d9' : '#9ca3af' }}>
                      {tempDiff > 0 ? `+${tempDiff}` : tempDiff}°
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">ОТКЛОНЕНИЕ</div>
                  </div>
                </div>
              </div>

              {lastUpdate && (
                <div className="mt-4 pt-4 border-t border-white/5 font-mono text-[10px] text-gray-600 text-right">
                  Обновлено: {formatTimeKR(lastUpdate)}
                </div>
              )}
            </div>

            {/* Hourly forecast - grid */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                ПОЧАСОВОЙ ПРОГНОЗ — {selectedDayName.toUpperCase()}
              </h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {selectedDayHourly.map((hour, i) => {
                  const Icon = getWeatherIcon(hour.weatherCode);
                  const isNow = selectedDayIndex === 0 && i === 0;
                  return (
                    <motion.div key={hour.time}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="text-center p-2 rounded-lg transition-all"
                      style={isNow
                        ? { background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)' }
                        : { background: 'rgba(255,255,255,0.03)' }
                      }>
                      <div className="font-mono text-[10px] text-gray-500 mb-1">
                        {isNow ? 'СЕЙЧАС' : formatHour(hour.time)}
                      </div>
                      <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: getWeatherColor(hour.weatherCode) }} />
                      <div className="font-mono text-xs font-bold text-gray-200">{Math.round(hour.temperature)}°</div>
                      {hour.precipitation > 0 && (
                        <div className="font-mono text-[8px] text-blue-400">{hour.precipitation}мм</div>
                      )}
                      <div className="font-mono text-[8px] text-gray-500">{Math.round(hour.windSpeed)}м/с</div>
                    </motion.div>
                  );
                })}
              </div>
              {selectedDayHourly.length === 0 && (
                <div className="text-center py-6 font-mono text-sm text-gray-500">
                  // НЕТ ДАННЫХ ДЛЯ ЭТОГО ДНЯ
                </div>
              )}
            </div>

            {/* 7-day forecast */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-mono font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                ПРОГНОЗ НА 7 ДНЕЙ <span className="font-normal text-gray-500">(кликни для почасового)</span>
              </h2>
              <div className="grid grid-cols-7 gap-2">
                {forecast.map((day, i) => {
                  const Icon = getWeatherIcon(day.weatherCode);
                  const today = isToday(day.date);
                  const isSelected = selectedDayIndex === i;
                  return (
                    <motion.div key={day.date}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedDayIndex(i)}
                      className="text-center p-3 rounded-xl transition-all cursor-pointer hover:scale-105"
                      style={isSelected
                        ? { background: 'rgba(0,255,136,0.15)', border: '2px solid rgba(0,255,136,0.5)', boxShadow: '0 0 15px rgba(0,255,136,0.2)' }
                        : today
                          ? { background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }
                          : { background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' }
                      }>
                      <div className="font-mono text-[10px] text-gray-500 mb-2">
                        {today ? 'СЕГОДНЯ' : formatDate(day.date).split(',')[0]}
                      </div>
                      <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: getWeatherColor(day.weatherCode) }} />
                      <div className="font-mono text-sm font-bold text-gray-200">{Math.round(day.tempMax)}°</div>
                      <div className="font-mono text-[10px] text-gray-500">{Math.round(day.tempMin)}°</div>
                      {day.precipitation > 0 && (
                        <div className="font-mono text-[9px] text-blue-400 mt-1">{day.precipitation}мм</div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  );
}
