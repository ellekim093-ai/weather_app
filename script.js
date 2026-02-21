// WEATHER PLATFORM — network error handling + Enhanced Globe

const cityInput = document.getElementById("cityInput");
const errorMsg  = document.getElementById("errorMsg");
const weatherIconContainer = document.getElementById("weatherIconContainer");
const bgVideo   = document.getElementById("bgVideo");

const apiKey = "2e3d2d2d9957fd5364e42c6cf4fe73e5";

cityInput.setAttribute('autocomplete', 'new-password');
bgVideo.setAttribute('playsinline', '');
bgVideo.setAttribute('webkit-playsinline', '');
bgVideo.muted = true;

// ─── NETWORK ERROR TYPES ──────────────────────────────────
const NetworkErrors = {
    OFFLINE:       'You appear to be offline. Please check your internet connection.',
    TIMEOUT:       'Request timed out. The server is taking too long to respond.',
    NOT_FOUND:     'City not found. Please check the spelling and try again.',
    RATE_LIMIT:    'Too many requests. Please wait a moment before searching again.',
    SERVER_ERROR:  'Weather service is having issues. Please try again in a few minutes.',
    UNKNOWN:       'Something went wrong. Please try again.',
};

// ─── FETCH WITH RETRY ─────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 3, timeoutMs = 8000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        if (!navigator.onLine) throw { type: 'OFFLINE', message: NetworkErrors.OFFLINE };
        try {
            const controller = new AbortController();
            const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);
            const response   = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.status === 404) throw { type: 'NOT_FOUND',    message: NetworkErrors.NOT_FOUND    };
            if (response.status === 429) throw { type: 'RATE_LIMIT',   message: NetworkErrors.RATE_LIMIT   };
            if (response.status >= 500)  throw { type: 'SERVER_ERROR', message: NetworkErrors.SERVER_ERROR };
            if (!response.ok)            throw { type: 'UNKNOWN',      message: NetworkErrors.UNKNOWN      };
            return await response.json();
        } catch (err) {
            if (err.type) throw err;
            if (err.name === 'AbortError') {
                if (attempt === retries) throw { type: 'TIMEOUT', message: NetworkErrors.TIMEOUT };
            }
            if (err instanceof TypeError && err.message.includes('fetch')) {
                if (attempt === retries) throw { type: 'OFFLINE', message: NetworkErrors.OFFLINE };
            }
            if (attempt < retries) {
                showError(`Connection issue. Retrying... (${attempt}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
}

function showError(message) { errorMsg.textContent = message; errorMsg.classList.add('show'); }
function clearError()       { errorMsg.textContent = ""; errorMsg.classList.remove('show'); }

window.addEventListener('offline', () => showError(NetworkErrors.OFFLINE));
window.addEventListener('online',  () => { clearError(); showError('✅ Back online!'); setTimeout(clearError, 2000); });

// ─── UNIT TOGGLE ──────────────────────────────────────────
let currentUnit = 'C';
function setUnit(unit) {
    currentUnit = unit;
    document.getElementById('btnCelsius').classList.toggle('active', unit === 'C');
    document.getElementById('btnFahrenheit').classList.toggle('active', unit === 'F');
    if (window.currentWeatherData) displayWeatherData(window.currentWeatherData);
    if (window.currentForecastData && window.currentWeatherData) {
        const d = window.currentWeatherData;
        displayForecastCalendar(window.currentForecastData, d.coord.lat, d.coord.lon);
    }
    if (window.selectedDayData) renderArchFromForecastDay(window.selectedDayData);
}
function toDisplayTemp(celsius) { return currentUnit === 'F' ? Math.round(celsius * 9/5 + 32) : Math.round(celsius); }
function tempLabel(celsius)     { return `${toDisplayTemp(celsius)}°${currentUnit}`; }

// ─── DEBOUNCE ─────────────────────────────────────────────
let searchDebounceTimer = null;
function debounce(fn, delay = 500) {
    return function (...args) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => fn(...args), delay);
    };
}

// ─── RATE LIMITER ─────────────────────────────────────────
const rateLimiter = {
    requests: [], maxRequests: 10, windowMs: 60 * 1000,
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        return this.requests.length < this.maxRequests;
    },
    recordRequest() { this.requests.push(Date.now()); }
};

// ─── SEARCH HISTORY ───────────────────────────────────────
const MAX_HISTORY = 8;
function getSearchHistory() {
    try { const raw = JSON.parse(localStorage.getItem('weatherSearchHistory') || '[]'); return raw.filter(h => typeof h === 'string' && h.trim().length > 0); }
    catch { return []; }
}
function saveSearchHistory(history) { localStorage.setItem('weatherSearchHistory', JSON.stringify(history)); }
function addToHistory(city) {
    if (typeof city !== 'string' || !city.trim()) return;
    let history = getSearchHistory();
    history = history.filter(h => typeof h === 'string' && h.toLowerCase() !== city.toLowerCase());
    history.unshift(city.trim());
    history = history.slice(0, MAX_HISTORY);
    saveSearchHistory(history);
}
function removeFromHistory(city) {
    let history = getSearchHistory();
    history = history.filter(h => h.toLowerCase() !== city.toLowerCase());
    saveSearchHistory(history);
    renderSearchHistory(cityInput.value);
    cityInput.focus();
}
function renderSearchHistory(filter = '') {
    const dropdown = document.getElementById('searchHistoryDropdown');
    let history = getSearchHistory();
    if (filter) history = history.filter(h => h.toLowerCase().includes(filter.toLowerCase()));
    if (history.length === 0) { dropdown.style.display = 'none'; return; }
    dropdown.innerHTML = '';
    history.forEach(city => {
        const row = document.createElement('div');
        row.className = 'history-item';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined history-icon';
        icon.textContent = 'history';
        const text = document.createElement('span');
        text.className = 'history-text';
        text.textContent = city;
        const btn = document.createElement('button');
        btn.className = 'history-delete';
        btn.title = 'Remove from history';
        const closeIcon = document.createElement('span');
        closeIcon.className = 'material-symbols-outlined';
        closeIcon.textContent = 'close';
        closeIcon.style.pointerEvents = 'none';
        btn.appendChild(closeIcon);
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); removeFromHistory(city); });
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); removeFromHistory(city); }, { passive: false });
        row.addEventListener('click', () => selectHistoryItem(city));
        row.appendChild(icon); row.appendChild(text); row.appendChild(btn);
        dropdown.appendChild(row);
    });
    dropdown.style.display = 'block';
}
function selectHistoryItem(city) {
    cityInput.value = city;
    document.getElementById('searchHistoryDropdown').style.display = 'none';
    fetchWeather(city);
}
function hideHistoryDropdown() { setTimeout(() => { document.getElementById('searchHistoryDropdown').style.display = 'none'; }, 150); }

cityInput.addEventListener('focus', () => renderSearchHistory(cityInput.value));
cityInput.addEventListener('input', () => renderSearchHistory(cityInput.value));
cityInput.addEventListener('blur', hideHistoryDropdown);
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) document.getElementById('searchHistoryDropdown').style.display = 'none';
});

// ─── SANITIZE ─────────────────────────────────────────────
function sanitizeCityInput(input) {
    return input.trim().replace(/[<>{}[\]\\^`|]/g, '').replace(/\s+/g, ' ').substring(0, 100);
}

// ─── UV INDEX (Open-Meteo) ────────────────────────────────
async function fetchRealUVIndex(lat, lon) {
    try {
        const data = await fetchWithRetry(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&forecast_days=1`,
            {}, 2, 5000
        );
        return Math.round(data.current?.uv_index ?? 0);
    } catch { return 0; }
}

// ─── ASTRONOMICAL DATA ────────────────────────────────────
async function fetchAstronomicalData(lat, lon, days = 14) {
    try {
        return await fetchWithRetry(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset,moonrise,moonset&timezone=auto&forecast_days=${days}`,
            {}, 2, 6000
        );
    } catch { return null; }
}

// ─── 14-DAY FORECAST ─────────────────────────────────────
async function fetchOpenMeteoForecast(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,` +
        `precipitation_sum,windspeed_10m_max,windgusts_10m_max,precipitation_probability_max,` +
        `relative_humidity_2m_max,relative_humidity_2m_min,pressure_msl_max,visibility_max,uv_index_max,sunrise,sunset` +
        `&timezone=auto&forecast_days=14`;
    return await fetchWithRetry(url, {}, 2, 8000);
}

// ─── WMO WEATHER CODE MAP ─────────────────────────────────
function wmoToWeather(code) {
    const map = {
        0:{'desc':'Clear sky','icon':'01d'},1:{'desc':'Mainly clear','icon':'01d'},2:{'desc':'Partly cloudy','icon':'02d'},
        3:{'desc':'Overcast','icon':'04d'},45:{'desc':'Fog','icon':'50d'},48:{'desc':'Icy fog','icon':'50d'},
        51:{'desc':'Light drizzle','icon':'09d'},53:{'desc':'Moderate drizzle','icon':'09d'},55:{'desc':'Dense drizzle','icon':'09d'},
        61:{'desc':'Slight rain','icon':'10d'},63:{'desc':'Moderate rain','icon':'10d'},65:{'desc':'Heavy rain','icon':'10d'},
        71:{'desc':'Slight snow','icon':'13d'},73:{'desc':'Moderate snow','icon':'13d'},75:{'desc':'Heavy snow','icon':'13d'},
        77:{'desc':'Snow grains','icon':'13d'},80:{'desc':'Slight showers','icon':'09d'},81:{'desc':'Moderate showers','icon':'09d'},
        82:{'desc':'Violent showers','icon':'09d'},85:{'desc':'Slight snow showers','icon':'13d'},86:{'desc':'Heavy snow showers','icon':'13d'},
        95:{'desc':'Thunderstorm','icon':'11d'},96:{'desc':'Thunderstorm w/ hail','icon':'11d'},99:{'desc':'Thunderstorm w/ hail','icon':'11d'},
    };
    return map[code] || { desc: 'Unknown', icon: '02d' };
}

// ─── BACKGROUND VIDEO ─────────────────────────────────────
function changeBackgroundVideo(iconCode, rainMmPerHour = 0) {
    let videoFile = "sunny.mp4";
    if      (iconCode === '01d')                                        videoFile = "sunny.mp4";
    else if (iconCode === '01n')                                        videoFile = "night.mp4";
    else if (['02d','02n','03d','03n','04d','04n'].includes(iconCode))  videoFile = "cloudy.mp4";
    else if (['09d','09n','10d','10n'].includes(iconCode))              videoFile = rainMmPerHour > 7.6 ? "heavy_rain.mp4" : "light_rain.mp4";
    else if (['11d','11n'].includes(iconCode))                          videoFile = "thunderstorm.mp4";
    else if (['13d','13n'].includes(iconCode))                          videoFile = "snow.mp4";
    else if (['50d','50n'].includes(iconCode))                          videoFile = "mist.mp4";
    const newSrc = `weather/${videoFile}`;
    if (bgVideo.getAttribute('src') === newSrc) return;
    bgVideo.setAttribute('src', newSrc); bgVideo.muted = true;
    bgVideo.setAttribute('playsinline',''); bgVideo.setAttribute('webkit-playsinline','');
    bgVideo.load();
    const playPromise = bgVideo.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            const retryPlay = () => { bgVideo.play().catch(()=>{}); };
            document.addEventListener('click', retryPlay, { once: true });
            document.addEventListener('keydown', retryPlay, { once: true });
            document.addEventListener('touchstart', retryPlay, { once: true });
        });
    }
}

function isDayTime(timezone, sunrise, sunset) {
    const nowUTC = Math.floor(Date.now() / 1000);
    return nowUTC + timezone >= sunrise && nowUTC + timezone < sunset;
}
function getCorrectIconCode(iconCode, isDay) {
    return iconCode.substring(0, 2) + (isDay ? 'd' : 'n');
}
function extractRainMmPerHour(data) {
    if (!data.rain) return 0;
    if (data.rain['1h'] !== undefined) return data.rain['1h'];
    if (data.rain['3h'] !== undefined) return data.rain['3h'] / 3;
    return 0;
}

function createWeatherIcon(iconCode) {
    weatherIconContainer.innerHTML = '';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'weather-icon-custom';
    if      (iconCode === '01d')                                             iconDiv.innerHTML = '<div class="sun-icon animated"></div>';
    else if (iconCode === '01n')                                             iconDiv.innerHTML = '<div class="moon-icon"></div>';
    else if (['02d','02n','03d','03n','04d','04n'].includes(iconCode))       iconDiv.innerHTML = `<div class="cloud-icon animated"><div class="cloud"></div></div>`;
    else if (['09d','09n','10d','10n'].includes(iconCode))                   iconDiv.innerHTML = `<div class="rain-icon"><div class="rain-cloud"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div></div>`;
    else if (['11d','11n'].includes(iconCode))                               iconDiv.innerHTML = `<div class="thunder-icon"><div class="thunder-cloud"></div><div class="lightning"></div></div>`;
    else if (['13d','13n'].includes(iconCode))                               iconDiv.innerHTML = `<div class="snow-icon"><div class="snow-cloud"></div><div class="snowflake">❄</div><div class="snowflake">❄</div><div class="snowflake">❄</div></div>`;
    else if (['50d','50n'].includes(iconCode))                               iconDiv.innerHTML = `<div class="mist-icon"><div class="mist-line"></div><div class="mist-line"></div><div class="mist-line"></div></div>`;
    else                                                                     iconDiv.innerHTML = `<div class="cloud-icon animated"><div class="cloud"></div></div>`;
    weatherIconContainer.appendChild(iconDiv);
}

// ─── DISPLAY WEATHER DATA ─────────────────────────────────
async function displayWeatherData(data) {
    clearError();
    window.selectedDayData = null;
    document.getElementById("cityText").textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById("tempValue").textContent = tempLabel(data.main.temp);
    const isDay = isDayTime(data.timezone, data.sys.sunrise, data.sys.sunset);
    const correctIconCode = getCorrectIconCode(data.weather[0].icon, isDay);
    createWeatherIcon(correctIconCode);
    changeBackgroundVideo(correctIconCode, extractRainMmPerHour(data));
    updateArchColor(data.main.temp);
    const humidity = data.main.humidity;
    document.getElementById("humidityBox").textContent = `${humidity}%`;
    updateHumidityStatus(humidity);
    document.getElementById("windBox").textContent = `${data.wind.speed} m/s`;
    const lat = data.coord.lat;
    const lon = data.coord.lon;
    let uvIndex = 0;
    if (isDay) uvIndex = await fetchRealUVIndex(lat, lon);
    document.getElementById("uvBox").textContent = uvIndex;
    updateUVStatus(uvIndex);
    const visibilityKm = data.visibility ? (data.visibility / 1000).toFixed(1) : 0;
    document.getElementById("visibilityBox").textContent = `${visibilityKm} km`;
    const pressure = data.main.pressure;
    document.getElementById("pressureBox").textContent = `${pressure} hPa`;
    updatePressureStatus(pressure);
    const feelsLikeC = data.main.feels_like;
    document.getElementById("feelsLikeBox").textContent = tempLabel(feelsLikeC);
    updateFeelsLikeStatus(feelsLikeC, data.main.temp);
    document.getElementById("condition").textContent = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
    updateDateTimeByTimezone(data);
    await updateSunMoonPanel(data);
    document.querySelectorAll('.cal-day-card').forEach(c => c.classList.remove('selected-day'));
    const todayCard = document.querySelector('.cal-day-card[data-index="today"]');
    if (todayCard) todayCard.classList.add('selected-day');
}

// ─── RENDER ARCH FROM FORECAST DAY ───────────────────────
function renderArchFromForecastDay(dayData) {
    window.selectedDayData = dayData;
    const maxTemp = dayData.maxTemp, minTemp = dayData.minTemp, avgTemp = (maxTemp + minTemp) / 2;
    const correctIconCode = getCorrectIconCode(dayData.icon, true);
    document.getElementById("tempValue").textContent = `${tempLabel(maxTemp)} / ${tempLabel(minTemp)}`;
    createWeatherIcon(correctIconCode);
    changeBackgroundVideo(correctIconCode, 0);
    updateArchColor(avgTemp);
    const daysOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const d = dayData.date;
    document.getElementById("currentDateTime").textContent = `📅 Forecast: ${daysOfWeek[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (clockInterval) clearInterval(clockInterval);
    document.getElementById("humidityBox").textContent = `${dayData.humidity}%`;
    updateHumidityStatus(dayData.humidity);
    document.getElementById("windBox").textContent = `${dayData.windSpeed} m/s`;
    document.getElementById("uvBox").textContent = dayData.uvIndex;
    updateUVStatus(dayData.uvIndex);
    document.getElementById("visibilityBox").textContent = `${dayData.visibility} km`;
    document.getElementById("pressureBox").textContent = `${dayData.pressure} hPa`;
    updatePressureStatus(dayData.pressure);
    document.getElementById("feelsLikeBox").textContent = tempLabel(dayData.feelsMax);
    updateFeelsLikeStatus(dayData.feelsMax, maxTemp);
    document.getElementById("condition").textContent = dayData.description.charAt(0).toUpperCase() + dayData.description.slice(1);
    updateSunMoonPanelForecast(dayData);
}

function updateArchColor(temperature) {
    const archInfo = document.querySelector('.arch-info');
    const temp = Math.round(temperature);
    let gradient = '';
    if      (temp >= 40) gradient = 'linear-gradient(135deg, #8B0000, #B22222, #DC143C)';
    else if (temp >= 32) gradient = 'linear-gradient(135deg, #FF4500, #FF6347, #FF7F50)';
    else if (temp >= 25) gradient = 'linear-gradient(135deg, #ebe71fd5, #bdb10f, #b6a50f)';
    else if (temp >= 18) gradient = 'linear-gradient(135deg, #32CD32, #3CB371, #2E8B57)';
    else if (temp >= 10) gradient = 'linear-gradient(135deg, #87CEEB, #4682B4, #5F9EA0)';
    else if (temp >= 0)  gradient = 'linear-gradient(135deg, #1E90FF, #0000CD, #00008B)';
    else                 gradient = 'linear-gradient(135deg, #000080, #191970, #4B0082)';
    archInfo.style.background = gradient;
}
function updateHumidityStatus(h) {
    const s = document.getElementById("humidityStatus"); s.className = "condition-status";
    if (h>=30&&h<=60) { s.textContent="Healthy"; s.classList.add("healthy"); }
    else if ((h>=20&&h<30)||(h>60&&h<=70)) { s.textContent="Moderate"; s.classList.add("moderate"); }
    else { s.textContent="Unhealthy"; s.classList.add("unhealthy"); }
}
function updateUVStatus(uv) {
    const s = document.getElementById("uvStatus"); s.className = "condition-status";
    if (uv<=2) { s.textContent="Low"; s.classList.add("healthy"); }
    else if (uv<=5) { s.textContent="Moderate"; s.classList.add("moderate"); }
    else if (uv<=7) { s.textContent="High"; s.classList.add("moderate"); }
    else if (uv<=10) { s.textContent="Very High"; s.classList.add("unhealthy"); }
    else { s.textContent="Extreme"; s.classList.add("unhealthy"); }
}
function updatePressureStatus(p) {
    const s = document.getElementById("pressureStatus"); s.className = "condition-status";
    if (p>=1013&&p<=1023) { s.textContent="Normal"; s.classList.add("healthy"); }
    else if (p>1023&&p<=1040) { s.textContent="High"; s.classList.add("moderate"); }
    else if (p>=1000&&p<1013) { s.textContent="Low"; s.classList.add("moderate"); }
    else if (p>1040) { s.textContent="V.High"; s.classList.add("unhealthy"); }
    else { s.textContent="V.Low"; s.classList.add("unhealthy"); }
}
function updateFeelsLikeStatus(feelsLike, actualTemp) {
    const s = document.getElementById("feelsLikeStatus"); s.className = "condition-status";
    const diff = feelsLike - actualTemp;
    if (Math.abs(diff)<=2) { s.textContent="Accurate"; s.classList.add("healthy"); }
    else if (diff>2) { s.textContent="Warmer"; s.classList.add("moderate"); }
    else { s.textContent="Cooler"; s.classList.add("moderate"); }
}

// ─── DATE/TIME ────────────────────────────────────────────
let clockInterval;
function updateDateTimeByTimezone(data) {
    const dateTimeEl = document.getElementById("currentDateTime");
    const tzOffset   = data.timezone;
    function updateClock() {
        const cityTime = new Date((Math.floor(Date.now()/1000) + tzOffset) * 1000);
        let h = cityTime.getUTCHours();
        const m = cityTime.getUTCMinutes().toString().padStart(2,'0');
        const ampm = h === 0 ? (h=12,'AM') : h === 12 ? 'PM' : h > 12 ? (h-=12,'PM') : 'AM';
        const daysOfWeek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        dateTimeEl.textContent = `${daysOfWeek[cityTime.getUTCDay()]}, ${cityTime.getUTCDate()} ${months[cityTime.getUTCMonth()]} ${cityTime.getUTCFullYear()}, ${h.toString().padStart(2,'0')}:${m} ${ampm}`;
    }
    if (clockInterval) clearInterval(clockInterval);
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

// ─── SUN/MOON PANEL ───────────────────────────────────────
let cachedAstroData = null, cachedAstroLatLon = null;
async function updateSunMoonPanel(data) {
    const lat = data.coord.lat, lon = data.coord.lon, timezone = data.timezone;
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (cachedAstroLatLon !== cacheKey) {
        cachedAstroData = await fetchAstronomicalData(lat, lon, 14);
        cachedAstroLatLon = cacheKey;
    }
    window.cachedAstroData = cachedAstroData;
    let sunriseISO, sunsetISO;
    if (cachedAstroData?.daily) {
        sunriseISO = cachedAstroData.daily.sunrise[0];
        sunsetISO  = cachedAstroData.daily.sunset[0];
    } else {
        sunriseISO = new Date(data.sys.sunrise * 1000).toISOString();
        sunsetISO  = new Date(data.sys.sunset  * 1000).toISOString();
    }
    function formatLocalTime(iso) {
        const parts = iso.split('T');
        if (parts.length < 2) return '--:--';
        const [hStr, mStr] = parts[1].split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mStr.padStart(2,'0')} ${ampm}`;
    }
    const sunriseUTC = Math.floor(new Date(sunriseISO).getTime() / 1000);
    const sunsetUTC  = Math.floor(new Date(sunsetISO).getTime()  / 1000);
    const nowUTC     = Math.floor(Date.now() / 1000);
    const cityNow    = nowUTC + timezone;
    const totalDay   = sunsetUTC - sunriseUTC;
    const elapsed    = Math.max(0, Math.min(cityNow - sunriseUTC, totalDay));
    const progress   = totalDay > 0 ? (elapsed / totalDay) * 100 : 0;
    const isDay      = cityNow >= sunriseUTC && cityNow < sunsetUTC;
    const daylightMin = Math.round(totalDay / 60);
    const moonPhase   = getMoonPhase(new Date());
    document.getElementById('sunriseTime').textContent      = formatLocalTime(sunriseISO);
    document.getElementById('sunsetTime').textContent       = formatLocalTime(sunsetISO);
    document.getElementById('daylightDuration').textContent = `${Math.floor(daylightMin/60)}h ${daylightMin%60}m`;
    document.getElementById('moonPhaseLabel').textContent   = moonPhase.name;
    document.getElementById('moonPhaseIcon').textContent    = moonPhase.emoji;
    const clamped = Math.max(0, Math.min(progress, 100));
    const arcPath = document.getElementById('sunArcPath');
    if (arcPath) { arcPath.style.strokeDashoffset = 150 - (clamped/100)*150; arcPath.style.transition = 'stroke-dashoffset 1.2s ease'; }
    const dot = document.getElementById('sunArcDot');
    if (dot) {
        const angle = (clamped/100) * Math.PI;
        dot.style.left    = `${50 - 45 * Math.cos(angle)}%`;
        dot.style.top     = `${80 - 45 * Math.sin(angle)}%`;
        dot.style.display = isDay ? 'block' : 'none';
    }
    const statusEl = document.getElementById('sunStatusText');
    if (statusEl) {
        if (isDay) {
            const rem = sunsetUTC - cityNow;
            if (rem > 0) { const rm=Math.round(rem/60); statusEl.textContent = `🌇 Sunset in ${Math.floor(rm/60)>0?Math.floor(rm/60)+'h ':''}${rm%60}m`; }
            else statusEl.textContent = '🌆 Past sunset';
        } else {
            const toSr = sunriseUTC + 86400 - cityNow;
            if (toSr > 0) { const rm=Math.round(toSr/60); statusEl.textContent = `🌅 Sunrise in ${Math.floor(rm/60)>0?Math.floor(rm/60)+'h ':''}${rm%60}m`; }
            else statusEl.textContent = '🌄 Dawn approaching';
        }
    }
}
function updateSunMoonPanelForecast(dayData) {
    function fmt(iso) {
        if (!iso) return '--:--';
        const parts = iso.split('T'); if (parts.length<2) return '--:--';
        const [hStr, mStr] = parts[1].split(':');
        let h = parseInt(hStr, 10);
        const ampm = h>=12?'PM':'AM'; h = h%12||12;
        return `${h}:${(mStr||'00').padStart(2,'0')} ${ampm}`;
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.getElementById('sunriseTime').textContent  = dayData.sunrise ? fmt(dayData.sunrise) : '~6:00 AM';
    document.getElementById('sunsetTime').textContent   = dayData.sunset  ? fmt(dayData.sunset)  : '~6:00 PM';
    if (dayData.sunrise && dayData.sunset) {
        const diffMin = Math.round((new Date(dayData.sunset)-new Date(dayData.sunrise))/60000);
        document.getElementById('daylightDuration').textContent = `${Math.floor(diffMin/60)}h ${diffMin%60}m`;
    } else { document.getElementById('daylightDuration').textContent = '~12h 0m'; }
    const phase = getMoonPhase(dayData.date);
    document.getElementById('moonPhaseLabel').textContent = phase.name;
    document.getElementById('moonPhaseIcon').textContent  = phase.emoji;
    document.getElementById('sunStatusText').textContent  = `📅 Forecast for ${dayData.date.getUTCDate()} ${months[dayData.date.getUTCMonth()]}`;
    const dot = document.getElementById('sunArcDot'); if (dot) dot.style.display = 'none';
    const arcPath = document.getElementById('sunArcPath'); if (arcPath) arcPath.style.strokeDashoffset = 0;
}

function getMoonPhase(date) {
    const year=date.getFullYear(),month=date.getMonth()+1,day=date.getDate();
    let jd = 367*year - Math.floor(7*(year+Math.floor((month+9)/12))/4) + Math.floor(275*month/9) + day + 1721013.5;
    const phase = ((jd-2451550.1)%29.53058867+29.53058867)%29.53058867;
    if (phase<1.85)  return {name:'New Moon',emoji:'🌑'};
    if (phase<5.54)  return {name:'Waxing Crescent',emoji:'🌒'};
    if (phase<9.22)  return {name:'First Quarter',emoji:'🌓'};
    if (phase<12.91) return {name:'Waxing Gibbous',emoji:'🌔'};
    if (phase<16.61) return {name:'Full Moon',emoji:'🌕'};
    if (phase<20.30) return {name:'Waning Gibbous',emoji:'🌖'};
    if (phase<23.99) return {name:'Last Quarter',emoji:'🌗'};
    if (phase<27.68) return {name:'Waning Crescent',emoji:'🌘'};
    return {name:'New Moon',emoji:'🌑'};
}

// ─── FORECAST CALENDAR ───────────────────────────────────
function showCalendarShimmer() {
    const grid = document.getElementById('calendarGrid'); grid.innerHTML = '';
    for (let i=0;i<14;i++) { const s=document.createElement('div'); s.className='cal-shimmer'; grid.appendChild(s); }
}
async function fetchForecast(city, lat, lon) {
    showCalendarShimmer();
    try {
        const data = await fetchOpenMeteoForecast(lat, lon);
        window.currentForecastData = data;
        displayForecastCalendar(data, lat, lon);
    } catch (err) {
        document.getElementById('calendarGrid').innerHTML = `<div style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.6);padding:20px;font-size:13px;">⚠️ Could not load forecast. ${err.message||NetworkErrors.UNKNOWN}</div>`;
    }
}
function displayForecastCalendar(forecastData, lat, lon) {
    const grid = document.getElementById('calendarGrid'); grid.innerHTML = '';
    const daysOfWeek=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const monthNames=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const daily = forecastData.daily;
    const numDays = Math.min(daily.time.length, 14);
    const todayStr = daily.time[0];
    for (let i=0;i<numDays;i++) {
        const dateStr=daily.time[i], dateObj=new Date(dateStr+'T12:00:00Z');
        const maxTemp=daily.temperature_2m_max[i], minTemp=daily.temperature_2m_min[i], avgTemp=(maxTemp+minTemp)/2;
        const wmo=daily.weathercode[i], weather=wmoToWeather(wmo);
        const humidity=Math.round((daily.relative_humidity_2m_max[i]+daily.relative_humidity_2m_min[i])/2);
        const wind=daily.windspeed_10m_max[i].toFixed(1), pressure=Math.round(daily.pressure_msl_max[i]);
        const feelsMax=daily.apparent_temperature_max[i];
        const vis=daily.visibility_max?(daily.visibility_max[i]/1000).toFixed(1):'--';
        const uv=daily.uv_index_max[i]!==undefined?Math.round(daily.uv_index_max[i]):0;
        const precip=daily.precipitation_probability_max[i]||0;
        const precipMm=daily.precipitation_sum[i]||0;
        const sunrise=daily.sunrise?daily.sunrise[i]:null, sunset=daily.sunset?daily.sunset[i]:null;
        const isToday=(dateStr===todayStr), isFirstFuture=(i===1);
        const tempDeg=Math.round(avgTemp);
        let tempColor='#FFD580';
        if (tempDeg>=35) tempColor='#ff7043'; else if (tempDeg>=28) tempColor='#ffa726';
        else if (tempDeg>=20) tempColor='#FFD580'; else if (tempDeg>=12) tempColor='#81d4fa'; else tempColor='#90caf9';
        const card = document.createElement('div');
        card.className = 'cal-day-card'+(isToday?' today':'');
        card.style.animationDelay = `${i*0.04}s`;
        card.dataset.index = isToday ? 'today' : i;
        const labelText = isToday?'Today':(isFirstFuture?'Tomorrow':daysOfWeek[dateObj.getUTCDay()]);
        card.innerHTML = `
            <div class="cal-info">
                <div class="cal-day-name">${labelText}</div>
                <div class="cal-date-label">${dateObj.getUTCDate()} ${monthNames[dateObj.getUTCMonth()]}</div>
                <div class="cal-condition">${weather.desc}</div>
                <div class="cal-temps">
                    <span class="cal-high" style="color:${tempColor}">${tempLabel(maxTemp)}</span>
                    <span class="cal-sep">·</span>
                    <span class="cal-low">${tempLabel(minTemp)}</span>
                </div>
                <div class="cal-humidity">💧 ${humidity}% · 🌧️ ${precip}%</div>
            </div>
            <div class="cal-click-hint"><span class="material-symbols-outlined">chevron_right</span></div>`;
        const dayData = { date:dateObj, maxTemp, minTemp, avgTemp, humidity, windSpeed:parseFloat(wind), pressure, feelsMax, visibility:vis, uvIndex:uv, precip, precipMm, icon:weather.icon, description:weather.desc, sunrise, sunset };
        card.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-card').forEach(c=>c.classList.remove('selected-day'));
            card.classList.add('selected-day');
            renderArchFromForecastDay(dayData);
        });
        grid.appendChild(card);
    }
}

// ─── MAIN FETCH WEATHER ──────────────────────────────────
async function fetchWeather(city, saveToHistory = true) {
    clearError();
    if (!rateLimiter.canMakeRequest()) { showError(NetworkErrors.RATE_LIMIT); return; }
    const sanitizedCity = sanitizeCityInput(city);
    if (!sanitizedCity) { showError('Please enter a valid city name.'); return; }
    if (!navigator.onLine) { showError(NetworkErrors.OFFLINE); return; }
    try {
        rateLimiter.recordRequest();
        const data = await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(sanitizedCity)}&units=metric&appid=${apiKey}`
        );
        await displayWeatherData(data);
        fetchForecast(sanitizedCity, data.coord.lat, data.coord.lon);
        window.currentWeatherData = data;
        if (saveToHistory) addToHistory(sanitizedCity);
    } catch (err) {
        showError(err.message || NetworkErrors.UNKNOWN);
        console.error('Weather fetch error:', err);
    }
}

function handleSearch() {
    const city = cityInput.value.trim();
    if (!city) { showError('Please enter a city name!'); return; }
    document.getElementById('searchHistoryDropdown').style.display = 'none';
    fetchWeather(city);
}
cityInput.addEventListener("keydown", e => { if (e.key==="Enter") { clearTimeout(searchDebounceTimer); handleSearch(); } });

// ─── INIT ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    try {
        let history = JSON.parse(localStorage.getItem('weatherSearchHistory')||'[]');
        history = history.filter(h=>typeof h==='string'&&h.trim().length>0);
        localStorage.setItem('weatherSearchHistory', JSON.stringify(history));
    } catch { localStorage.removeItem('weatherSearchHistory'); }
    fetchWeather("Manila", false);
});

// ============================================================
// GLOBE — 150+ cities, search bar, red pin, temp-colored dots
// ============================================================

let globe = null;
let globeRotating = true;
let rotationSpeed = 0.15;
let rotationAnimFrame = null;
let currentPOV = { lat: 0, lng: 0, altitude: 2.5 };
let globeOpen  = false;
let globePanelVisible = true;
let globePanelMinWidth = 160, globePanelMaxWidth = 420;

// ─── TEMPERATURE DOT COLOR ────────────────────────────────
// Returns a color based on city latitude (climate zone approximation)
// When live temp data is loaded, dots get updated
let cityTempCache = {}; // { "CityName,Country": tempC }

function getTempColor(tempC) {
    if (tempC === undefined || tempC === null) return 'rgba(200, 230, 255, 0.7)';
    if (tempC >= 40) return '#ff1a1a';
    if (tempC >= 35) return '#ff5500';
    if (tempC >= 30) return '#ff8800';
    if (tempC >= 25) return '#ffcc00';
    if (tempC >= 20) return '#aaee00';
    if (tempC >= 15) return '#44dd88';
    if (tempC >= 10) return '#00ccff';
    if (tempC >= 0)  return '#44aaff';
    if (tempC >= -10) return '#8888ff';
    return '#cc88ff';
}

// Estimate temperature from latitude (rough climate model, used before live data)
function estimateTempFromLatitude(lat) {
    const absLat = Math.abs(lat);
    if (absLat < 10)  return 30;
    if (absLat < 20)  return 28;
    if (absLat < 30)  return 24;
    if (absLat < 40)  return 18;
    if (absLat < 50)  return 12;
    if (absLat < 60)  return 5;
    if (absLat < 70)  return -5;
    return -20;
}

// ─── EXPANDED WORLD CITIES (150+) ────────────────────────
const worldCities = [
    // Philippines
    { name:"Manila",         country:"PH", lat:14.5995,  lng:120.9842, capital:true  },
    { name:"Cebu",           country:"PH", lat:10.3157,  lng:123.8854, capital:false },
    { name:"Davao",          country:"PH", lat:7.0707,   lng:125.6087, capital:false },
    { name:"Quezon City",    country:"PH", lat:14.6760,  lng:121.0437, capital:false },
    // East Asia
    { name:"Tokyo",          country:"JP", lat:35.6762,  lng:139.6503, capital:true  },
    { name:"Osaka",          country:"JP", lat:34.6937,  lng:135.5023, capital:false },
    { name:"Kyoto",          country:"JP", lat:35.0116,  lng:135.7681, capital:false },
    { name:"Sapporo",        country:"JP", lat:43.0642,  lng:141.3469, capital:false },
    { name:"Seoul",          country:"KR", lat:37.5665,  lng:126.9780, capital:true  },
    { name:"Busan",          country:"KR", lat:35.1796,  lng:129.0756, capital:false },
    { name:"Beijing",        country:"CN", lat:39.9042,  lng:116.4074, capital:true  },
    { name:"Shanghai",       country:"CN", lat:31.2304,  lng:121.4737, capital:false },
    { name:"Guangzhou",      country:"CN", lat:23.1291,  lng:113.2644, capital:false },
    { name:"Shenzhen",       country:"CN", lat:22.5431,  lng:114.0579, capital:false },
    { name:"Chengdu",        country:"CN", lat:30.5728,  lng:104.0668, capital:false },
    { name:"Hong Kong",      country:"HK", lat:22.3193,  lng:114.1694, capital:false },
    { name:"Taipei",         country:"TW", lat:25.0330,  lng:121.5654, capital:true  },
    { name:"Ulaanbaatar",    country:"MN", lat:47.8864,  lng:106.9057, capital:true  },
    // Southeast Asia
    { name:"Singapore",      country:"SG", lat:1.3521,   lng:103.8198, capital:true  },
    { name:"Bangkok",        country:"TH", lat:13.7563,  lng:100.5018, capital:true  },
    { name:"Chiang Mai",     country:"TH", lat:18.7883,  lng:98.9853,  capital:false },
    { name:"Jakarta",        country:"ID", lat:-6.2088,  lng:106.8456, capital:true  },
    { name:"Bali",           country:"ID", lat:-8.3405,  lng:115.0920, capital:false },
    { name:"Kuala Lumpur",   country:"MY", lat:3.1390,   lng:101.6869, capital:true  },
    { name:"Hanoi",          country:"VN", lat:21.0285,  lng:105.8542, capital:true  },
    { name:"Ho Chi Minh",    country:"VN", lat:10.8231,  lng:106.6297, capital:false },
    { name:"Phnom Penh",     country:"KH", lat:11.5564,  lng:104.9282, capital:true  },
    { name:"Yangon",         country:"MM", lat:16.8661,  lng:96.1951,  capital:false },
    { name:"Vientiane",      country:"LA", lat:17.9757,  lng:102.6331, capital:true  },
    { name:"Bandar Seri Beg",country:"BN", lat:4.9031,   lng:114.9398, capital:true  },
    // South Asia
    { name:"Dhaka",          country:"BD", lat:23.8103,  lng:90.4125,  capital:true  },
    { name:"Colombo",        country:"LK", lat:6.9271,   lng:79.8612,  capital:true  },
    { name:"New Delhi",      country:"IN", lat:28.6139,  lng:77.2090,  capital:true  },
    { name:"Mumbai",         country:"IN", lat:19.0760,  lng:72.8777,  capital:false },
    { name:"Bangalore",      country:"IN", lat:12.9716,  lng:77.5946,  capital:false },
    { name:"Chennai",        country:"IN", lat:13.0827,  lng:80.2707,  capital:false },
    { name:"Kolkata",        country:"IN", lat:22.5726,  lng:88.3639,  capital:false },
    { name:"Hyderabad",      country:"IN", lat:17.3850,  lng:78.4867,  capital:false },
    { name:"Karachi",        country:"PK", lat:24.8607,  lng:67.0011,  capital:false },
    { name:"Islamabad",      country:"PK", lat:33.6844,  lng:73.0479,  capital:true  },
    { name:"Kathmandu",      country:"NP", lat:27.7172,  lng:85.3240,  capital:true  },
    { name:"Kabul",          country:"AF", lat:34.5553,  lng:69.2075,  capital:true  },
    // Central/West Asia
    { name:"Tehran",         country:"IR", lat:35.6892,  lng:51.3890,  capital:true  },
    { name:"Baghdad",        country:"IQ", lat:33.3152,  lng:44.3661,  capital:true  },
    { name:"Riyadh",         country:"SA", lat:24.7136,  lng:46.6753,  capital:true  },
    { name:"Jeddah",         country:"SA", lat:21.4858,  lng:39.1925,  capital:false },
    { name:"Dubai",          country:"AE", lat:25.2048,  lng:55.2708,  capital:false },
    { name:"Abu Dhabi",      country:"AE", lat:24.4539,  lng:54.3773,  capital:true  },
    { name:"Doha",           country:"QA", lat:25.2854,  lng:51.5310,  capital:true  },
    { name:"Kuwait City",    country:"KW", lat:29.3759,  lng:47.9774,  capital:true  },
    { name:"Muscat",         country:"OM", lat:23.5880,  lng:58.3829,  capital:true  },
    { name:"Amman",          country:"JO", lat:31.9454,  lng:35.9284,  capital:true  },
    { name:"Beirut",         country:"LB", lat:33.8886,  lng:35.4955,  capital:true  },
    { name:"Tel Aviv",       country:"IL", lat:32.0853,  lng:34.7818,  capital:false },
    { name:"Jerusalem",      country:"IL", lat:31.7683,  lng:35.2137,  capital:true  },
    { name:"Ankara",         country:"TR", lat:39.9334,  lng:32.8597,  capital:true  },
    { name:"Istanbul",       country:"TR", lat:41.0082,  lng:28.9784,  capital:false },
    { name:"Tashkent",       country:"UZ", lat:41.2995,  lng:69.2401,  capital:true  },
    { name:"Almaty",         country:"KZ", lat:43.2220,  lng:76.8512,  capital:false },
    { name:"Baku",           country:"AZ", lat:40.4093,  lng:49.8671,  capital:true  },
    { name:"Tbilisi",        country:"GE", lat:41.6938,  lng:44.8015,  capital:true  },
    { name:"Yerevan",        country:"AM", lat:40.1792,  lng:44.4991,  capital:true  },
    // Europe
    { name:"London",         country:"GB", lat:51.5074,  lng:-0.1278,  capital:true  },
    { name:"Manchester",     country:"GB", lat:53.4808,  lng:-2.2426,  capital:false },
    { name:"Edinburgh",      country:"GB", lat:55.9533,  lng:-3.1883,  capital:false },
    { name:"Paris",          country:"FR", lat:48.8566,  lng:2.3522,   capital:true  },
    { name:"Lyon",           country:"FR", lat:45.7640,  lng:4.8357,   capital:false },
    { name:"Marseille",      country:"FR", lat:43.2965,  lng:5.3698,   capital:false },
    { name:"Berlin",         country:"DE", lat:52.5200,  lng:13.4050,  capital:true  },
    { name:"Munich",         country:"DE", lat:48.1351,  lng:11.5820,  capital:false },
    { name:"Hamburg",        country:"DE", lat:53.5753,  lng:10.0153,  capital:false },
    { name:"Frankfurt",      country:"DE", lat:50.1109,  lng:8.6821,   capital:false },
    { name:"Madrid",         country:"ES", lat:40.4168,  lng:-3.7038,  capital:true  },
    { name:"Barcelona",      country:"ES", lat:41.3851,  lng:2.1734,   capital:false },
    { name:"Rome",           country:"IT", lat:41.9028,  lng:12.4964,  capital:true  },
    { name:"Milan",          country:"IT", lat:45.4642,  lng:9.1900,   capital:false },
    { name:"Naples",         country:"IT", lat:40.8518,  lng:14.2681,  capital:false },
    { name:"Amsterdam",      country:"NL", lat:52.3676,  lng:4.9041,   capital:true  },
    { name:"Brussels",       country:"BE", lat:50.8503,  lng:4.3517,   capital:true  },
    { name:"Vienna",         country:"AT", lat:48.2082,  lng:16.3738,  capital:true  },
    { name:"Zurich",         country:"CH", lat:47.3769,  lng:8.5417,   capital:false },
    { name:"Geneva",         country:"CH", lat:46.2044,  lng:6.1432,   capital:false },
    { name:"Prague",         country:"CZ", lat:50.0755,  lng:14.4378,  capital:true  },
    { name:"Warsaw",         country:"PL", lat:52.2297,  lng:21.0122,  capital:true  },
    { name:"Budapest",       country:"HU", lat:47.4979,  lng:19.0402,  capital:true  },
    { name:"Bucharest",      country:"RO", lat:44.4268,  lng:26.1025,  capital:true  },
    { name:"Sofia",          country:"BG", lat:42.6977,  lng:23.3219,  capital:true  },
    { name:"Belgrade",       country:"RS", lat:44.7866,  lng:20.4489,  capital:true  },
    { name:"Zagreb",         country:"HR", lat:45.8150,  lng:15.9819,  capital:true  },
    { name:"Athens",         country:"GR", lat:37.9838,  lng:23.7275,  capital:true  },
    { name:"Stockholm",      country:"SE", lat:59.3293,  lng:18.0686,  capital:true  },
    { name:"Oslo",           country:"NO", lat:59.9139,  lng:10.7522,  capital:true  },
    { name:"Copenhagen",     country:"DK", lat:55.6761,  lng:12.5683,  capital:true  },
    { name:"Helsinki",       country:"FI", lat:60.1699,  lng:24.9384,  capital:true  },
    { name:"Tallinn",        country:"EE", lat:59.4370,  lng:24.7536,  capital:true  },
    { name:"Riga",           country:"LV", lat:56.9460,  lng:24.1059,  capital:true  },
    { name:"Vilnius",        country:"LT", lat:54.6872,  lng:25.2797,  capital:true  },
    { name:"Lisbon",         country:"PT", lat:38.7223,  lng:-9.1393,  capital:true  },
    { name:"Porto",          country:"PT", lat:41.1579,  lng:-8.6291,  capital:false },
    { name:"Dublin",         country:"IE", lat:53.3498,  lng:-6.2603,  capital:true  },
    { name:"Reykjavik",      country:"IS", lat:64.1355,  lng:-21.8954, capital:true  },
    { name:"Moscow",         country:"RU", lat:55.7558,  lng:37.6173,  capital:true  },
    { name:"St Petersburg",  country:"RU", lat:59.9343,  lng:30.3351,  capital:false },
    { name:"Kyiv",           country:"UA", lat:50.4501,  lng:30.5234,  capital:true  },
    { name:"Minsk",          country:"BY", lat:53.9045,  lng:27.5615,  capital:true  },
    { name:"Bratislava",     country:"SK", lat:48.1486,  lng:17.1077,  capital:true  },
    { name:"Ljubljana",      country:"SI", lat:46.0569,  lng:14.5058,  capital:true  },
    { name:"Sarajevo",       country:"BA", lat:43.8563,  lng:18.4131,  capital:true  },
    { name:"Tirana",         country:"AL", lat:41.3275,  lng:19.8187,  capital:true  },
    // Africa
    { name:"Cairo",          country:"EG", lat:30.0444,  lng:31.2357,  capital:true  },
    { name:"Alexandria",     country:"EG", lat:31.2001,  lng:29.9187,  capital:false },
    { name:"Casablanca",     country:"MA", lat:33.5731,  lng:-7.5898,  capital:false },
    { name:"Marrakech",      country:"MA", lat:31.6295,  lng:-7.9811,  capital:false },
    { name:"Tunis",          country:"TN", lat:36.8190,  lng:10.1658,  capital:true  },
    { name:"Algiers",        country:"DZ", lat:36.7538,  lng:3.0588,   capital:true  },
    { name:"Addis Ababa",    country:"ET", lat:9.1450,   lng:40.4897,  capital:true  },
    { name:"Nairobi",        country:"KE", lat:-1.2921,  lng:36.8219,  capital:true  },
    { name:"Mombasa",        country:"KE", lat:-4.0435,  lng:39.6682,  capital:false },
    { name:"Dar es Salaam",  country:"TZ", lat:-6.7924,  lng:39.2083,  capital:false },
    { name:"Kampala",        country:"UG", lat:0.3476,   lng:32.5825,  capital:true  },
    { name:"Kigali",         country:"RW", lat:-1.9441,  lng:30.0619,  capital:true  },
    { name:"Lagos",          country:"NG", lat:6.5244,   lng:3.3792,   capital:false },
    { name:"Abuja",          country:"NG", lat:9.0765,   lng:7.3986,   capital:true  },
    { name:"Accra",          country:"GH", lat:5.6037,   lng:-0.1870,  capital:true  },
    { name:"Dakar",          country:"SN", lat:14.7167,  lng:-17.4677, capital:true  },
    { name:"Kinshasa",       country:"CD", lat:-4.4419,  lng:15.2663,  capital:true  },
    { name:"Luanda",         country:"AO", lat:-8.8383,  lng:13.2344,  capital:true  },
    { name:"Johannesburg",   country:"ZA", lat:-26.2041, lng:28.0473,  capital:false },
    { name:"Cape Town",      country:"ZA", lat:-33.9249, lng:18.4241,  capital:false },
    { name:"Pretoria",       country:"ZA", lat:-25.7461, lng:28.1881,  capital:true  },
    { name:"Durban",         country:"ZA", lat:-29.8587, lng:31.0218,  capital:false },
    { name:"Maputo",         country:"MZ", lat:-25.9692, lng:32.5732,  capital:true  },
    { name:"Antananarivo",   country:"MG", lat:-18.8792, lng:47.5079,  capital:true  },
    { name:"Khartoum",       country:"SD", lat:15.5007,  lng:32.5599,  capital:true  },
    { name:"Tripoli",        country:"LY", lat:32.8872,  lng:13.1913,  capital:true  },
    // Americas
    { name:"Washington DC",  country:"US", lat:38.9072,  lng:-77.0369, capital:true  },
    { name:"New York",       country:"US", lat:40.7128,  lng:-74.0060, capital:false },
    { name:"Los Angeles",    country:"US", lat:34.0522,  lng:-118.2437,capital:false },
    { name:"Chicago",        country:"US", lat:41.8781,  lng:-87.6298, capital:false },
    { name:"Houston",        country:"US", lat:29.7604,  lng:-95.3698, capital:false },
    { name:"Phoenix",        country:"US", lat:33.4484,  lng:-112.0740,capital:false },
    { name:"San Francisco",  country:"US", lat:37.7749,  lng:-122.4194,capital:false },
    { name:"Seattle",        country:"US", lat:47.6062,  lng:-122.3321,capital:false },
    { name:"Miami",          country:"US", lat:25.7617,  lng:-80.1918, capital:false },
    { name:"Boston",         country:"US", lat:42.3601,  lng:-71.0589, capital:false },
    { name:"Dallas",         country:"US", lat:32.7767,  lng:-96.7970, capital:false },
    { name:"Atlanta",        country:"US", lat:33.7490,  lng:-84.3880, capital:false },
    { name:"Las Vegas",      country:"US", lat:36.1699,  lng:-115.1398,capital:false },
    { name:"Denver",         country:"US", lat:39.7392,  lng:-104.9903,capital:false },
    { name:"Honolulu",       country:"US", lat:21.3069,  lng:-157.8583,capital:false },
    { name:"Anchorage",      country:"US", lat:61.2181,  lng:-149.9003,capital:false },
    { name:"Toronto",        country:"CA", lat:43.6532,  lng:-79.3832, capital:false },
    { name:"Montreal",       country:"CA", lat:45.5017,  lng:-73.5673, capital:false },
    { name:"Vancouver",      country:"CA", lat:49.2827,  lng:-123.1207,capital:false },
    { name:"Ottawa",         country:"CA", lat:45.4215,  lng:-75.6972, capital:true  },
    { name:"Calgary",        country:"CA", lat:51.0447,  lng:-114.0719,capital:false },
    { name:"Mexico City",    country:"MX", lat:19.4326,  lng:-99.1332, capital:true  },
    { name:"Guadalajara",    country:"MX", lat:20.6597,  lng:-103.3496,capital:false },
    { name:"Monterrey",      country:"MX", lat:25.6866,  lng:-100.3161,capital:false },
    { name:"Havana",         country:"CU", lat:23.1136,  lng:-82.3666, capital:true  },
    { name:"Panama City",    country:"PA", lat:8.9936,   lng:-79.5197, capital:true  },
    { name:"Bogota",         country:"CO", lat:4.7110,   lng:-74.0721, capital:true  },
    { name:"Medellin",       country:"CO", lat:6.2476,   lng:-75.5658, capital:false },
    { name:"Caracas",        country:"VE", lat:10.4806,  lng:-66.9036, capital:true  },
    { name:"Lima",           country:"PE", lat:-12.0464, lng:-77.0428, capital:true  },
    { name:"Quito",          country:"EC", lat:-0.1807,  lng:-78.4678, capital:true  },
    { name:"La Paz",         country:"BO", lat:-16.5000, lng:-68.1193, capital:true  },
    { name:"São Paulo",      country:"BR", lat:-23.5505, lng:-46.6333, capital:false },
    { name:"Rio de Janeiro", country:"BR", lat:-22.9068, lng:-43.1729, capital:false },
    { name:"Brasilia",       country:"BR", lat:-15.7801, lng:-47.9292, capital:true  },
    { name:"Manaus",         country:"BR", lat:-3.1190,  lng:-60.0217, capital:false },
    { name:"Buenos Aires",   country:"AR", lat:-34.6037, lng:-58.3816, capital:true  },
    { name:"Santiago",       country:"CL", lat:-33.4489, lng:-70.6693, capital:true  },
    { name:"Montevideo",     country:"UY", lat:-34.9011, lng:-56.1645, capital:true  },
    { name:"Asuncion",       country:"PY", lat:-25.2867, lng:-57.6470, capital:true  },
    // Oceania
    { name:"Sydney",         country:"AU", lat:-33.8688, lng:151.2093, capital:false },
    { name:"Melbourne",      country:"AU", lat:-37.8136, lng:144.9631, capital:false },
    { name:"Brisbane",       country:"AU", lat:-27.4698, lng:153.0251, capital:false },
    { name:"Perth",          country:"AU", lat:-31.9505, lng:115.8605, capital:false },
    { name:"Adelaide",       country:"AU", lat:-34.9285, lng:138.6007, capital:false },
    { name:"Canberra",       country:"AU", lat:-35.2809, lng:149.1300, capital:true  },
    { name:"Auckland",       country:"NZ", lat:-36.8485, lng:174.7633, capital:false },
    { name:"Wellington",     country:"NZ", lat:-41.2866, lng:174.7756, capital:true  },
    { name:"Christchurch",   country:"NZ", lat:-43.5321, lng:172.6362, capital:false },
    { name:"Suva",           country:"FJ", lat:-18.1248, lng:178.4501, capital:true  },
    { name:"Port Moresby",   country:"PG", lat:-9.4438,  lng:147.1803, capital:true  },
];

// ─── GLOBE: build points data with temperature colors ────
function buildGlobePointsData() {
    return worldCities.map(city => {
        const cacheKey = `${city.name},${city.country}`;
        const tempC = cityTempCache[cacheKey] !== undefined
            ? cityTempCache[cacheKey]
            : estimateTempFromLatitude(city.lat);
        return {
            ...city,
            color: getTempColor(tempC),
            radius: city.capital ? 0.55 : 0.35,
            altitude: 0.005,
            tempC,
        };
    });
}

// ─── SELECTED CITY PIN (DOM overlay — tracks city every frame) ───
let pinEl = null;
let pinnedLat = null;
let pinnedLng = null;

function ensurePinEl() {
    if (pinEl) return pinEl;
    pinEl = document.createElement('div');
    pinEl.id = 'globeSelectedPin';
    pinEl.innerHTML = `<div class="globe-pin-circle"></div><div class="globe-pin-needle"></div>`;
    document.querySelector('.globe-container').appendChild(pinEl);
    return pinEl;
}

// Called every rAF frame from the rotation loop to keep the pin locked to the city
function updatePinPosition() {
    const pin = ensurePinEl();
    // Hide pin whenever globe is auto-rotating
    if (globeRotating || pinnedLat === null || !globe) {
        pin.classList.remove('visible');
        return;
    }
    try {
        const coords = globe.getScreenCoords(pinnedLat, pinnedLng, 0.01);
        if (coords && coords.x !== undefined && !isNaN(coords.x)) {
            pin.style.left = `${coords.x}px`;
            pin.style.top  = `${coords.y}px`;
            pin.classList.add('visible');
        } else {
            pin.classList.remove('visible');
        }
    } catch(e) {
        pin.classList.remove('visible');
    }
}

function showPinAt(lat, lng) {
    pinnedLat = lat;
    pinnedLng = lng;
    // Position will be updated by the rAF loop next tick
}

function hidePinEl() {
    pinnedLat = null;
    pinnedLng = null;
    if (pinEl) pinEl.classList.remove('visible');
}

// ─── GLOBE SEARCH BAR ─────────────────────────────────────
function buildGlobeSearchBar() {
    const container = document.querySelector('.globe-container');
    if (!container || document.getElementById('globeSearchWrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'globe-search-wrapper';
    wrapper.id = 'globeSearchWrapper';
    wrapper.innerHTML = `
        <div class="globe-search-inner" id="globeSearchInner">
            <span class="globe-search-icon material-symbols-outlined">travel_explore</span>
            <input type="text" id="globeSearchInput" placeholder="Search any city on the globe…" autocomplete="off" />
            <button class="globe-search-clear-btn" id="globeSearchClearBtn" title="Clear">✕</button>
            <button class="globe-search-btn" id="globeSearchBtn">Go</button>
        </div>
        <div class="globe-search-dropdown" id="globeSearchDropdown"></div>
    `;
    container.appendChild(wrapper);

    const input    = document.getElementById('globeSearchInput');
    const dropdown = document.getElementById('globeSearchDropdown');
    const clearBtn = document.getElementById('globeSearchClearBtn');
    const goBtn    = document.getElementById('globeSearchBtn');

    let suggestionIndex = -1;

    function renderSuggestions(query) {
        dropdown.innerHTML = '';
        if (!query.trim()) { dropdown.classList.remove('open'); return; }
        const q = query.toLowerCase().trim();
        const matches = worldCities.filter(c =>
            c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
        ).slice(0, 8);

        if (matches.length === 0) {
            dropdown.innerHTML = `<div class="globe-search-no-results">No cities found for "${query}"</div>`;
            dropdown.classList.add('open');
            return;
        }
        matches.forEach((city, idx) => {
            const item = document.createElement('div');
            item.className = 'globe-suggestion-item';
            item.dataset.idx = idx;
            const cacheKey = `${city.name},${city.country}`;
            const temp = cityTempCache[cacheKey];
            const tempStr = temp !== undefined ? `${Math.round(temp)}°C` : '';
            const tempDot = `<span style="width:8px;height:8px;border-radius:50%;background:${getTempColor(temp??estimateTempFromLatitude(city.lat))};display:inline-block;margin-right:6px;border:1px solid rgba(255,255,255,0.3);flex-shrink:0;"></span>`;
            item.innerHTML = `
                <span class="globe-sugg-icon material-symbols-outlined">location_on</span>
                ${tempDot}
                <span class="globe-sugg-name">${city.name}</span>
                <span class="globe-sugg-country">${city.country}</span>
                ${city.capital ? '<span class="globe-sugg-capital">Capital</span>' : ''}
                ${tempStr ? `<span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,0.5);padding-left:8px;">${tempStr}</span>` : ''}
            `;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                flyToCity(city);
                input.value = city.name;
                dropdown.classList.remove('open');
                clearBtn.classList.toggle('visible', !!input.value);
            });
            dropdown.appendChild(item);
        });
        dropdown.classList.add('open');
        suggestionIndex = -1;
    }

    input.addEventListener('input', () => {
        renderSuggestions(input.value);
        clearBtn.classList.toggle('visible', !!input.value);
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.globe-suggestion-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            suggestionIndex = Math.max(suggestionIndex - 1, -1);
            items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestionIndex >= 0 && items[suggestionIndex]) {
                items[suggestionIndex].dispatchEvent(new Event('mousedown'));
            } else {
                globeSearchGo();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('open');
            input.blur();
        }
        // Stop arrow keys from controlling globe rotation when typing
        e.stopPropagation();
    });

    input.addEventListener('focus', () => { if (input.value) renderSuggestions(input.value); });
    input.addEventListener('blur',  () => { setTimeout(() => dropdown.classList.remove('open'), 200); });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        dropdown.classList.remove('open');
        clearBtn.classList.remove('visible');
        input.focus();
    });

    goBtn.addEventListener('click', globeSearchGo);
}

function globeSearchGo() {
    const input = document.getElementById('globeSearchInput');
    if (!input) return;
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const match = worldCities.find(c => c.name.toLowerCase() === q || c.name.toLowerCase().startsWith(q));
    if (match) {
        flyToCity(match);
        document.getElementById('globeSearchDropdown').classList.remove('open');
    } else {
        // Try to fetch weather by city name directly
        handleGlobeSearchByName(input.value.trim());
    }
}

async function handleGlobeSearchByName(cityName) {
    if (!cityName) return;
    try {
        const data = await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${apiKey}`,
            {}, 2, 6000
        );
        const lat = data.coord.lat, lng = data.coord.lon;
        const name = data.name;
        document.getElementById('globeCity').textContent   = `${name}, ${data.sys.country}`;
        document.getElementById('globeCoords').textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        globe.pointOfView({ lat, lng: lng, altitude: 1.5 }, 1200);
        currentPOV = { lat, lng, altitude: 1.5 };
        globeRotating = false;
        showPinAt(lat, lng);
        fetchGlobeWeather(lat, lng, name);
        setTimeout(() => { globeRotating = true; }, 5000);
    } catch(err) {
        document.getElementById('globeCity').textContent = `City "${cityName}" not found`;
    }
}

function flyToCity(city) {
    if (!globe) return;
    globeRotating = false;
    globe.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.5 }, 1200);
    currentPOV = { lat: city.lat, lng: city.lng, altitude: 1.5 };
    document.getElementById('globeCity').textContent   = `${city.name}, ${city.country}`;
    document.getElementById('globeCoords').textContent = `${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}°`;
    showPinAt(city.lat, city.lng);
    fetchGlobeWeather(city.lat, city.lng, city.name);
    setTimeout(() => { globeRotating = true; }, 5000);
}

// ─── TEMPERATURE LEGEND ───────────────────────────────────
function buildTempLegend() {
    const container = document.querySelector('.globe-container');
    if (!container || document.getElementById('globeTempLegend')) return;
    const legend = document.createElement('div');
    legend.className = 'globe-temp-legend';
    legend.id = 'globeTempLegend';
    legend.innerHTML = `
        <div class="globe-temp-legend-title">🌡 City Temp</div>
        <div class="globe-temp-legend-bar"></div>
        <div class="globe-temp-legend-labels">
            <span>Cold</span><span>Cool</span><span>Warm</span><span>Hot</span><span>🔥</span>
        </div>
        <div class="globe-legend-dot-row" style="margin-top:6px;">
            <div class="globe-legend-dot" style="background:#cc88ff"></div>
            <span class="globe-legend-dot-label">&lt;0°C</span>
        </div>
        <div class="globe-legend-dot-row">
            <div class="globe-legend-dot" style="background:#44aaff"></div>
            <span class="globe-legend-dot-label">0–15°C</span>
        </div>
        <div class="globe-legend-dot-row">
            <div class="globe-legend-dot" style="background:#aaee00"></div>
            <span class="globe-legend-dot-label">15–25°C</span>
        </div>
        <div class="globe-legend-dot-row">
            <div class="globe-legend-dot" style="background:#ffcc00"></div>
            <span class="globe-legend-dot-label">25–30°C</span>
        </div>
        <div class="globe-legend-dot-row">
            <div class="globe-legend-dot" style="background:#ff8800"></div>
            <span class="globe-legend-dot-label">30–35°C</span>
        </div>
        <div class="globe-legend-dot-row">
            <div class="globe-legend-dot" style="background:#ff1a1a"></div>
            <span class="globe-legend-dot-label">&gt;40°C</span>
        </div>
    `;
    container.appendChild(legend);
}

// ─── GLOBE PANEL FUNCTIONS ────────────────────────────────
function toggleGlobePanel() {
    globePanelVisible = !globePanelVisible;
    const panel = document.getElementById('globeWeatherPanel');
    const btn   = document.getElementById('globePanelToggleBtn');
    if (globePanelVisible) {
        panel.style.display = '';
        btn.title = 'Hide weather panel';
        btn.querySelector('.material-symbols-outlined').textContent = 'chevron_right';
    } else {
        panel.style.display = 'none';
        btn.title = 'Show weather panel';
        btn.querySelector('.material-symbols-outlined').textContent = 'chevron_left';
    }
    setTimeout(resizeGlobe, 50);
}

function resizeGlobe() {
    if (!globe) return;
    const container = document.getElementById('globeViz');
    if (container) { globe.width(container.clientWidth); globe.height(container.clientHeight); }
}

function initPanelResize() {
    const handle = document.getElementById('globePanelResizeHandle');
    const panel  = document.getElementById('globeWeatherPanel');
    if (!handle || !panel) return;
    let startX, startW;
    function onMouseMove(e) {
        const dx = startX - e.clientX;
        const newW = Math.min(globePanelMaxWidth, Math.max(globePanelMinWidth, startW + dx));
        panel.style.width = newW + 'px';
        resizeGlobe();
    }
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        handle.classList.remove('dragging');
    }
    handle.addEventListener('mousedown', (e) => {
        startX = e.clientX; startW = panel.offsetWidth;
        handle.classList.add('dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
    handle.addEventListener('touchstart', (e) => { startX=e.touches[0].clientX; startW=panel.offsetWidth; handle.classList.add('dragging'); e.preventDefault(); }, {passive:false});
    handle.addEventListener('touchmove', (e) => {
        const newW = Math.min(globePanelMaxWidth, Math.max(globePanelMinWidth, startW + (startX - e.touches[0].clientX)));
        panel.style.width = newW + 'px'; resizeGlobe(); e.preventDefault();
    }, {passive:false});
    handle.addEventListener('touchend', () => handle.classList.remove('dragging'));
}

// ─── GLOBE WEATHER FETCH ──────────────────────────────────
async function fetchGlobeWeather(lat, lng, locationName) {
    document.getElementById('globeEmptyState').style.display = 'none';
    document.getElementById('globeLoading').style.display   = 'flex';
    const boxIds = ['globeTempBox','globeConditionBox','globeWindBox','globeHumidityBox','globeVisBox','globeUVBox'];
    boxIds.forEach(id => { document.getElementById(id).style.display = 'none'; });
    if (!navigator.onLine) { document.getElementById('globeLoading').style.display='none'; showGlobeError(NetworkErrors.OFFLINE); return; }
    try {
        const data = await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`,
            {}, 3, 8000
        );
        const isDay = data.dt >= data.sys.sunrise && data.dt <= data.sys.sunset;
        const uvIndex = isDay ? await fetchRealUVIndex(lat, lng) : 0;
        const cityName = data.name || locationName || 'Unknown Location';

        // Update dot color cache and refresh globe points
        const cacheKey = `${cityName},${data.sys.country}`;
        cityTempCache[cacheKey] = data.main.temp;
        if (globe) {
            const pts = buildGlobePointsData();
            globe.pointsData(pts);
        }

        document.getElementById('globeCity').textContent   = `${cityName}, ${data.sys.country}`;
        document.getElementById('globeCoords').textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        document.getElementById('globeTempValue').textContent  = tempLabel(data.main.temp);
        document.getElementById('globeFeelsLike').textContent  = `Feels like ${tempLabel(data.main.feels_like)}`;
        const condDesc = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
        document.getElementById('globeCondValue').textContent  = condDesc;
        document.getElementById('globeCondDetail').textContent = `Humidity: ${data.main.humidity}%`;
        const iconMap = {'01':'wb_sunny','02':'partly_cloudy_day','03':'cloud','04':'cloud','09':'rainy','10':'rainy','11':'thunderstorm','13':'ac_unit','50':'foggy'};
        document.getElementById('globeCondIcon').textContent = iconMap[data.weather[0].icon.substring(0,2)] || 'wb_sunny';
        document.getElementById('globeWindValue').textContent = `${data.wind.speed} m/s`;
        document.getElementById('globeWindDir').textContent   = `Direction: ${data.wind.deg ?? '--'}°`;
        document.getElementById('globeHumidValue').textContent = `${data.main.humidity}%`;
        document.getElementById('globePressure').textContent   = `Pressure: ${data.main.pressure} hPa`;
        const visKm = data.visibility ? (data.visibility/1000).toFixed(1) : '--';
        document.getElementById('globeVisValue').textContent = `${visKm} km`;
        const sunrise = new Date(data.sys.sunrise*1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
        const sunset  = new Date(data.sys.sunset*1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
        document.getElementById('globeSunrise').textContent = `☀️ ${sunrise} — 🌙 ${sunset}`;
        document.getElementById('globeUVValue').textContent  = uvIndex !== null ? uvIndex : '--';
        document.getElementById('globeUVDetail').textContent = getUVLabel(uvIndex);

        // Update temp color on panel header
        const panelHeader = document.querySelector('.globe-panel-header');
        if (panelHeader) panelHeader.style.borderBottom = `2px solid ${getTempColor(data.main.temp)}`;

        document.getElementById('globeLoading').style.display = 'none';
        boxIds.forEach(id => { document.getElementById(id).style.display = 'flex'; });
    } catch (err) {
        document.getElementById('globeLoading').style.display = 'none';
        showGlobeError(err.message || NetworkErrors.UNKNOWN);
    }
}

function showGlobeError(message) {
    const emptyState = document.getElementById('globeEmptyState');
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
        <div style="font-size:40px;text-align:center;margin-bottom:12px">⚠️</div>
        <p style="color:rgba(255,255,255,0.7);text-align:center;font-size:13px;line-height:1.6">${message}</p>`;
}

function getUVLabel(uv) {
    if (uv===null||uv===undefined) return 'N/A';
    if (uv<=2) return 'Low'; if (uv<=5) return 'Moderate';
    if (uv<=7) return 'High'; if (uv<=10) return 'Very High';
    return 'Extreme';
}

// ─── GLOBE INIT ───────────────────────────────────────────
function initGlobe() {
    const container = document.getElementById('globeViz');
    if (!container || typeof Globe === 'undefined') return;

    const initialPoints = buildGlobePointsData();

    globe = Globe()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('rgba(100, 180, 255, 0.4)')
        .atmosphereAltitude(0.15)
        // City dots with temperature colors
        .pointsData(initialPoints)
        .pointLat(d => d.lat)
        .pointLng(d => d.lng)
        .pointColor(d => d.color)
        .pointAltitude(d => d.altitude)
        .pointRadius(d => d.radius)
        .pointResolution(12)
        .pointsMerge(false)
        .onPointClick(d => flyToCity(d))
        // City labels
        .labelsData(worldCities)
        .labelLat(d => d.lat)
        .labelLng(d => d.lng)
        .labelText(d => d.name)
        .labelSize(d => d.capital ? 1.15 : 0.75)
        .labelColor(d => d.capital ? 'rgba(255, 240, 100, 0.95)' : 'rgba(200, 230, 255, 0.85)')
        .labelDotRadius(0)
        .labelResolution(3)
        .labelAltitude(0.015)
        .onLabelClick(d => flyToCity(d))
        .onGlobeClick(({ lat, lng }) => handleGlobeClick(lat, lng))
        (container);

    globe.pointOfView({ lat: 14.5995, lng: 120.9842, altitude: 2.5 }, 1000);
    currentPOV = { lat: 14.5995, lng: 120.9842, altitude: 2.5 };

    globeRotating = true;
    startRotation();
    setupGlobeControls();
    initPanelResize();
    buildGlobeSearchBar();
    buildTempLegend();
    ensurePinEl();
    document.addEventListener('keydown', handleGlobeKeyboard);

    // Preload temps for first 20 cities in background
    preloadCityTemps();
}

// Preload temperatures for major cities to color dots more accurately
async function preloadCityTemps() {
    // Batch: load temperatures for the first 20 most major cities
    const major = worldCities.filter(c => c.capital).slice(0, 20);
    for (const city of major) {
        try {
            const data = await fetchWithRetry(
                `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&units=metric&appid=${apiKey}`,
                {}, 1, 4000
            );
            const cacheKey = `${city.name},${city.country}`;
            cityTempCache[cacheKey] = data.main.temp;
            // Throttle requests
            await new Promise(r => setTimeout(r, 300));
        } catch(e) {}
    }
    // Refresh globe dots with real temp data
    if (globe) globe.pointsData(buildGlobePointsData());
}

// ─── GLOBE CLICK HANDLERS ────────────────────────────────
function handleGlobeClick(lat, lng) {
    const wasRotating = globeRotating;
    globeRotating = false;
    globe.pointOfView({ lat, lng, altitude: 1.8 }, 800);
    currentPOV = { lat, lng, altitude: 1.8 };
    document.getElementById('globeCoords').textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    document.getElementById('globeCity').textContent   = 'Fetching location...';
    showPinAt(lat, lng);
    fetchGlobeWeather(lat, lng, null);
    if (wasRotating) setTimeout(() => { globeRotating = true; }, 3000);
}

// ─── ROTATION ─────────────────────────────────────────────
function startRotation() {
    if (rotationAnimFrame) cancelAnimationFrame(rotationAnimFrame);
    function rotate() {
        if (globe && globeRotating && globeOpen) {
            const pov = globe.pointOfView();
            globe.pointOfView({ lat: pov.lat, lng: pov.lng + rotationSpeed, altitude: pov.altitude });
        }
        // Pin tracks city every frame; hides automatically when globeRotating is true
        updatePinPosition();
        rotationAnimFrame = requestAnimationFrame(rotate);
    }
    rotate();
}
function stopRotation() {
    if (rotationAnimFrame) { cancelAnimationFrame(rotationAnimFrame); rotationAnimFrame = null; }
}

// ─── GLOBE CONTROLS ───────────────────────────────────────
function setupGlobeControls() {
    document.getElementById('globeZoomIn').addEventListener('click', () => {
        const pov = globe.pointOfView(); const newAlt = Math.max(0.5, pov.altitude-0.3);
        globe.pointOfView({lat:pov.lat,lng:pov.lng,altitude:newAlt},300); currentPOV.altitude=newAlt;
    });
    document.getElementById('globeZoomOut').addEventListener('click', () => {
        const pov = globe.pointOfView(); const newAlt = Math.min(8, pov.altitude+0.3);
        globe.pointOfView({lat:pov.lat,lng:pov.lng,altitude:newAlt},300); currentPOV.altitude=newAlt;
    });
    document.getElementById('globePauseRotation').addEventListener('click', () => {
        globeRotating = !globeRotating;
        document.getElementById('pauseIcon').textContent = globeRotating ? 'pause' : 'play_arrow';
        document.getElementById('globePauseRotation').title = globeRotating ? 'Pause Rotation' : 'Resume Rotation';
        // Immediately update pin visibility on toggle
        updatePinPosition();
    });
    document.getElementById('globeRotateUp').addEventListener('click',    () => nudgeGlobe(5, 0));
    document.getElementById('globeRotateDown').addEventListener('click',  () => nudgeGlobe(-5, 0));
    document.getElementById('globeRotateLeft').addEventListener('click',  () => nudgeGlobe(0, -10));
    document.getElementById('globeRotateRight').addEventListener('click', () => nudgeGlobe(0, 10));
    let holdInterval = null;
    const arrowActions = { globeRotateUp:()=>nudgeGlobe(3,0), globeRotateDown:()=>nudgeGlobe(-3,0), globeRotateLeft:()=>nudgeGlobe(0,-6), globeRotateRight:()=>nudgeGlobe(0,6) };
    Object.keys(arrowActions).forEach(id => {
        const btn = document.getElementById(id);
        btn.addEventListener('mousedown',  () => { holdInterval = setInterval(arrowActions[id], 80); });
        btn.addEventListener('mouseup',    () => clearInterval(holdInterval));
        btn.addEventListener('mouseleave', () => clearInterval(holdInterval));
    });
}
function nudgeGlobe(latDelta, lngDelta) {
    if (!globe) return;
    const pov = globe.pointOfView();
    globe.pointOfView({lat:Math.max(-80,Math.min(80,pov.lat+latDelta)),lng:pov.lng+lngDelta,altitude:pov.altitude},200);
}
function handleGlobeKeyboard(e) {
    const activeTag = document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
    if (!globeOpen || !globe) return;
    switch(e.key) {
        case 'ArrowUp':    e.preventDefault(); nudgeGlobe(5,0);   break;
        case 'ArrowDown':  e.preventDefault(); nudgeGlobe(-5,0);  break;
        case 'ArrowLeft':  e.preventDefault(); nudgeGlobe(0,-10); break;
        case 'ArrowRight': e.preventDefault(); nudgeGlobe(0,10);  break;
        case '+': case '=': { const p=globe.pointOfView(); globe.pointOfView({lat:p.lat,lng:p.lng,altitude:Math.max(0.5,p.altitude-0.3)},300); break; }
        case '-':           { const p=globe.pointOfView(); globe.pointOfView({lat:p.lat,lng:p.lng,altitude:Math.min(8,p.altitude+0.3)},300);  break; }
        case ' ': e.preventDefault(); globeRotating=!globeRotating; document.getElementById('pauseIcon').textContent=globeRotating?'pause':'play_arrow'; break;
    }
}

function toggleGlobeView() {
    const globeSection = document.getElementById('globeSection');
    const isHidden = globeSection.style.display==='none' || globeSection.style.display==='';
    if (isHidden) {
        globeSection.style.display = 'block';
        globeOpen = true;
        if (!globe) {
            setTimeout(() => initGlobe(), 100);
        } else {
            globeRotating = true;
            const icon = document.getElementById('pauseIcon');
            if (icon) icon.textContent = 'pause';
            setTimeout(resizeGlobe, 100);
            if (!rotationAnimFrame) startRotation();
        }
    } else {
        globeSection.style.display = 'none';
        globeOpen = false;
        stopRotation();
        hidePinEl();
    }
}

// ============================================================
// KILA CHATBOT
// ============================================================
function toggleKila() {
    const chatContainer = document.getElementById('chatContainer');
    const toggleBtn     = document.getElementById('kilaToggle');
    chatContainer.classList.toggle('active');
    toggleBtn.classList.toggle('active');
    toggleBtn.textContent = chatContainer.classList.contains('active') ? '✖️' : '🌤️';
}

const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');
let conversationHistory = [];

function addMessage(content, isUser, isHtml = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🌤️';
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    if (isHtml) messageContent.innerHTML = content;
    else        messageContent.textContent = content;
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot'; typingDiv.id = 'typingIndicator';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar'; avatar.textContent = '🌤️';
    const typing = document.createElement('div');
    typing.className = 'typing-indicator active';
    typing.innerHTML = '<span></span><span></span><span></span>';
    typingDiv.appendChild(avatar); typingDiv.appendChild(typing);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function hideTypingIndicator() { const t = document.getElementById('typingIndicator'); if (t) t.remove(); }

async function fetchWeatherDataChat(city) {
    try {
        return await fetchWithRetry(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(sanitizeCityInput(city))}&units=metric&appid=${apiKey}`,
            {}, 2, 6000
        );
    } catch { return null; }
}

function classifyIntent(message) {
    const m = message.toLowerCase();
    if (/\b(hi|hello|hey|hola|kumusta|good morning|good afternoon|good evening)\b/i.test(m)) return 'greeting';
    if (/\b(thank|thanks|salamat|appreciate|grateful)\b/i.test(m)) return 'gratitude';
    if (/\b(how are you|how're you|kumusta ka|kamusta)\b/i.test(m)) return 'how_are_you';
    if (/\b(bye|goodbye|see you|paalam)\b/i.test(m)) return 'goodbye';
    if (/\b(help|assist|guide|what can you do)\b/i.test(m)) return 'help';
    if (/\b(current|now|today|right now)\b/i.test(m) && /\b(weather|temperature|temp|condition)\b/i.test(m)) return 'weather_current';
    if (/\b(rain|raining|ulan|drizzle|precipitation)\b/i.test(m)) return 'weather_rain';
    if (/\b(hot|cold|warm|cool|mainit|malamig|temperature|temp)\b/i.test(m)) return 'weather_temperature';
    if (/\b(humid|humidity|moisture|muggy|dry)\b/i.test(m)) return 'weather_humidity';
    if (/\b(wind|windy|breeze|hangin|gust)\b/i.test(m)) return 'weather_wind';
    if (/\b(pressure|barometric|hpa)\b/i.test(m)) return 'weather_pressure';
    if (/\b(feels like|feel like|apparent)\b/i.test(m)) return 'weather_feelslike';
    if (/\b(wear|wearing|clothes|clothing|outfit|jacket|coat)\b/i.test(m)) return 'advice_clothing';
    if (/\b(umbrella|payong)\b/i.test(m)) return 'advice_umbrella';
    if (/\b(outdoor|outside|picnic|hike|walk|run|jog|exercise)\b/i.test(m)) return 'advice_outdoor';
    if (/\b(weather|forecast|panahon|climate|conditions)\b/i.test(m)) return 'weather_general';
    return 'unknown';
}

async function generateNLPResponse(userMessage) {
    const intent = classifyIntent(userMessage);
    const d = window.currentWeatherData;
    await new Promise(resolve => setTimeout(resolve, 300));
    conversationHistory.push({ role:'user', message:userMessage, intent });
    if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);
    switch(intent) {
        case 'greeting':    return ["Hey there! ☀️ I'm Kila, your weather buddy!","Hi! 🌤️ Great to see you!","Hello! 👋 I'm Kila! Ready to help!"][Math.floor(Math.random()*3)];
        case 'gratitude':   return ["You're welcome! 🌈","My pleasure! 😊","Anytime! 💙"][Math.floor(Math.random()*3)];
        case 'how_are_you': return "Doing fantastic! ☀️ Just like a perfect sunny day! How can I help? 🌈";
        case 'goodbye':     return "Take care! 👋 Stay weather-aware! ☀️";
        case 'help':        return `I'm Kila! 🌤️ Ask me:\n🌡️ Temperature & feels like\n🌧️ Rain predictions\n💨 Wind speed\n💧 Humidity\n☀️ UV index\n\nTry: "Weather in Tokyo" 🌍`;
        case 'weather_current': return d ? `${d.name}: ${tempLabel(d.main.temp)} (feels ${tempLabel(d.main.feels_like)}), ${d.weather[0].description}. Humidity ${d.main.humidity}%, wind ${d.wind.speed} m/s 💨` : "Search for a city above! 🌍";
        case 'weather_rain': if (d) { const desc=d.weather[0].description.toLowerCase(); return desc.includes('rain')||desc.includes('drizzle') ? `Yes! Raining in ${d.name}! ☔` : `No rain in ${d.name} right now! ☀️ (${desc})`; } return "Tell me a city to check rain! 🌍";
        case 'weather_temperature': if (d) { const t=toDisplayTemp(d.main.temp); const desc=t>(currentUnit==='F'?86:30)?'HOT! 🔥':t>(currentUnit==='F'?68:20)?'Comfortable! 😊':'Cool! ❄️'; return `${d.name}: ${desc}\nActual: ${tempLabel(d.main.temp)}, feels like ${tempLabel(d.main.feels_like)}`; } return "Which city? 🌍";
        case 'weather_humidity': return d ? `Humidity in ${d.name}: ${d.main.humidity}%! ${d.main.humidity>80?'Very muggy! 💦':d.main.humidity>60?'Humid! 💧':'Comfortable! ✨'}` : "Which city? 🌍";
        case 'weather_wind': return d ? `Wind in ${d.name}: ${d.wind.speed} m/s ${d.wind.speed>10?'🌪️ Very windy!':d.wind.speed>5?'💨 Breezy!':'🍃 Calm!'}` : "Which city? 🌍";
        case 'weather_pressure': return d ? `Pressure in ${d.name}: ${d.main.pressure} hPa ${d.main.pressure>=1013&&d.main.pressure<=1023?'✅ Normal':'⚠️ Abnormal'}` : "Which city? 🌍";
        case 'weather_feelslike': return d ? `In ${d.name}, actual: ${tempLabel(d.main.temp)}, feels like: ${tempLabel(d.main.feels_like)} ${Math.abs(d.main.feels_like-d.main.temp)<=2?'✅ Similar!':d.main.feels_like>d.main.temp?'💦 Warmer due to humidity':'💨 Cooler due to wind'}` : "Which city? 🌍";
        case 'advice_clothing': return d ? getClothingAdvice(d.main.temp) + `\n${d.name}: ${tempLabel(d.main.temp)} 👕` : "Tell me your city! 🌍";
        case 'advice_umbrella': if (d) { const desc=d.weather[0].description.toLowerCase(); return desc.includes('rain')||desc.includes('drizzle') ? `YES! ☔ It's raining in ${d.name}!` : d.main.humidity>70 ? `Not raining but ${d.main.humidity}% humidity — maybe! ⛅` : `No umbrella needed! ☀️ ${d.name} looks clear!`; } return "Which city? ☔";
        case 'advice_outdoor': if (d) { const desc=d.weather[0].description.toLowerCase(); return desc.includes('rain')||desc.includes('storm') ? `Not ideal! 🌧️ Consider indoors.` : d.main.temp>35 ? `Very hot! 🔥 Stay hydrated!` : d.main.temp<5 ? `Bundle up! ❄️ It's cold!` : `Great for outdoors! ☀️ ${tempLabel(d.main.temp)}, ${desc}`; } return "Tell me your city! 🌍";
        default: return "Ask me anything about weather! 🌤️\nTry: 'Weather in London' or 'Will it rain?' 🌍";
    }
}

function getClothingAdvice(tempC) {
    if (tempC>30) return "Light, breathable clothing! Shorts & t-shirts! 🩳👕";
    if (tempC>25) return "Light summer clothes! 👗👔";
    if (tempC>20) return "Light shirt, maybe a light jacket! 👕🧥";
    if (tempC>15) return "Long sleeves and pants! 👖🧥";
    if (tempC>10) return "Wear a jacket! Getting cold! 🧥❄️";
    return "Bundle up! Heavy jacket, scarf! 🧣🧥";
}
function extractCityFromMessage(message) {
    const patterns = [
        /weather (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
        /(?:what's|whats|what is) (?:the )?weather (?:like )?(?:in|at) ([a-z\s]+?)(?:\?|$)/i,
        /temperature (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
        /forecast (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
    ];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) return match[1].trim();
    }
    return null;
}
function getWeatherEmoji(iconCode) {
    if (iconCode.startsWith('01')) return '☀️';
    if (iconCode.startsWith('02')) return '⛅';
    if (iconCode.startsWith('03')||iconCode.startsWith('04')) return '☁️';
    if (iconCode.startsWith('09')||iconCode.startsWith('10')) return '🌧️';
    if (iconCode.startsWith('11')) return '⛈️';
    if (iconCode.startsWith('13')) return '❄️';
    if (iconCode.startsWith('50')) return '🌫️';
    return '🌤️';
}
function createWeatherCard(data) {
    const emoji = getWeatherEmoji(data.weather[0].icon);
    const description = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
    return `
        <div class="weather-card">
            <div class="weather-icon">${emoji}</div>
            <h3>${data.name}, ${data.sys.country}</h3>
            <h3>${description}</h3>
            <div class="weather-info">
                <div class="weather-info-row"><span>🌡️ Temperature:</span><strong>${tempLabel(data.main.temp)}</strong></div>
                <div class="weather-info-row"><span>🤔 Feels like:</span><strong>${tempLabel(data.main.feels_like)}</strong></div>
                <div class="weather-info-row"><span>💧 Humidity:</span><strong>${data.main.humidity}%</strong></div>
                <div class="weather-info-row"><span>💨 Wind:</span><strong>${data.wind.speed} m/s</strong></div>
                <div class="weather-info-row"><span>🌡️ Pressure:</span><strong>${data.main.pressure} hPa</strong></div>
            </div>
        </div>`;
}
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    addMessage(message, true);
    chatInput.value = '';
    showTypingIndicator();
    const cityName = extractCityFromMessage(message);
    if (cityName) {
        const weatherData = await fetchWeatherDataChat(cityName);
        hideTypingIndicator();
        if (weatherData) {
            addMessage(createWeatherCard(weatherData), false, true);
            window.currentWeatherData = weatherData;
            showTypingIndicator();
            await new Promise(resolve => setTimeout(resolve, 500));
            const temp=weatherData.main.temp, fl=weatherData.main.feels_like, cond=weatherData.weather[0].description, hum=weatherData.main.humidity;
            let insight = `${temp>30?'Hot! 🔥':temp>25?'Warm! ☀️':temp>20?'Comfortable! 😊':temp>15?'Cool! 🍃':'Cold! ❄️'} ${cityName} is ${tempLabel(temp)}. `;
            if (Math.abs(fl-temp)>3) insight += `Feels like ${tempLabel(fl)}. `;
            if (cond.includes('rain')) insight += `It's raining — grab an umbrella! ☔`;
            else if (cond.includes('cloud')) insight += `Cloudy skies! ⛅`;
            else if (cond.includes('clear')) insight += `Clear skies! ☀️`;
            if (hum>70) insight += ` Humidity ${hum}% — feels muggy! 💦`;
            hideTypingIndicator();
            addMessage(insight, false);
        } else {
            addMessage(navigator.onLine ? `Couldn't find "${cityName}"! Check spelling or try another city! 🌍` : "You seem offline! 📡 Check your internet connection.", false);
        }
    } else {
        const response = await generateNLPResponse(message);
        hideTypingIndicator();
        if (response) addMessage(response, false);
    }
}
function sendSuggestion(text) { chatInput.value = text; sendMessage(); }
function handleChatKeyPress(event) { if (event.key==='Enter') { event.preventDefault(); sendMessage(); } }