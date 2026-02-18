// WEATHER PLATFORM SCRIPT


const cityInput = document.getElementById("cityInput");
const errorMsg  = document.getElementById("errorMsg");
const weatherIconContainer = document.getElementById("weatherIconContainer");
const bgVideo   = document.getElementById("bgVideo");

const apiKey = "2e3d2d2d9957fd5364e42c6cf4fe73e5";

// ============================================
// SEARCH HISTORY
// ============================================

const MAX_HISTORY = 8;

function getSearchHistory() {
    try {
        const raw = JSON.parse(localStorage.getItem('weatherSearchHistory') || '[]');
        return raw.filter(h => typeof h === 'string' && h.trim().length > 0);
    } catch { return []; }
}

function saveSearchHistory(history) {
    localStorage.setItem('weatherSearchHistory', JSON.stringify(history));
}

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

    if (filter) {
        history = history.filter(h => h.toLowerCase().includes(filter.toLowerCase()));
    }

    if (history.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

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

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeFromHistory(city);
        });

        // Touch support for mobile devices
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeFromHistory(city);
        }, { passive: false });

        row.addEventListener('click', () => selectHistoryItem(city));

        row.appendChild(icon);
        row.appendChild(text);
        row.appendChild(btn);
        dropdown.appendChild(row);
    });

    dropdown.style.display = 'block';
}

function selectHistoryItem(city) {
    cityInput.value = city;
    document.getElementById('searchHistoryDropdown').style.display = 'none';
    fetchWeather(city);
}

function hideHistoryDropdown() {
    setTimeout(() => {
        document.getElementById('searchHistoryDropdown').style.display = 'none';
    }, 150);
}

cityInput.addEventListener('focus', () => renderSearchHistory(cityInput.value));
cityInput.addEventListener('input', () => renderSearchHistory(cityInput.value));
cityInput.addEventListener('blur', hideHistoryDropdown);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        document.getElementById('searchHistoryDropdown').style.display = 'none';
    }
});


// ============================================
// BACKGROUND VIDEO
// ============================================

function changeBackgroundVideo(iconCode) {
    let videoFile = "sunny.mp4";
    if      (iconCode === '01d')                                             videoFile = "sunny.mp4";
    else if (iconCode === '01n')                                             videoFile = "clear_night.mp4";
    else if (['02d','02n','03d','03n','04d','04n'].includes(iconCode))       videoFile = "cloudy.mp4";
    else if (['09d','09n','10d','10n'].includes(iconCode))                   videoFile = "light_rain.mp4";
    else if (['11d','11n'].includes(iconCode))                               videoFile = "thunderstorm.mp4";
    else if (['13d','13n'].includes(iconCode))                               videoFile = "snow.mp4";
    else if (['50d','50n'].includes(iconCode))                               videoFile = "mist.mp4";

    const newSrc = `weather/${videoFile}`;
    if (bgVideo.getAttribute('src') !== newSrc) {
        bgVideo.setAttribute('src', newSrc);
        bgVideo.load();
        bgVideo.play().catch(() => {});
    }
}

function isDayTime(timezone, sunrise, sunset) {
    const nowUTC = Math.floor(Date.now() / 1000);
    const cityTimeSeconds = nowUTC + timezone;
    return cityTimeSeconds >= sunrise && cityTimeSeconds < sunset;
}

function getCorrectIconCode(iconCode, isDay) {
    const baseCode = iconCode.substring(0, 2);
    return baseCode + (isDay ? 'd' : 'n');
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

function getCustomPanelIcon(iconCode) {
    if      (iconCode === '01d')                                             return `<div class="sun-icon"></div>`;
    if      (iconCode === '01n')                                             return `<div class="moon-icon"></div>`;
    if (['02d','02n','03d','03n','04d','04n'].includes(iconCode))            return `<div class="cloud-icon"><div class="cloud"></div></div>`;
    if (['09d','09n','10d','10n'].includes(iconCode))                        return `<div class="rain-icon"><div class="rain-cloud"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div></div>`;
    if (['11d','11n'].includes(iconCode))                                    return `<div class="thunder-icon"><div class="thunder-cloud"></div><div class="lightning"></div></div>`;
    if (['13d','13n'].includes(iconCode))                                    return `<div class="snow-icon"><div class="snow-cloud"></div><div class="snowflake">❄</div><div class="snowflake">❄</div><div class="snowflake">❄</div></div>`;
    if (['50d','50n'].includes(iconCode))                                    return `<div class="mist-icon"><div class="mist-line"></div><div class="mist-line"></div><div class="mist-line"></div></div>`;
    return `<div class="cloud-icon"><div class="cloud"></div></div>`;
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add('show');
}

function clearError() {
    errorMsg.textContent = "";
    errorMsg.classList.remove('show');
}

function calculateUVIndex(data) {
    const isDay = isDayTime(data.timezone, data.sys.sunrise, data.sys.sunset);
    if (!isDay) return 0;
    const cloudCover = data.clouds?.all || 0;
    if (cloudCover > 80) return Math.floor(Math.random() * 3) + 1;
    if (cloudCover > 50) return Math.floor(Math.random() * 3) + 4;
    if (cloudCover > 20) return Math.floor(Math.random() * 3) + 6;
    return Math.floor(Math.random() * 3) + 8;
}

function displayWeatherData(data) {
    clearError();
    document.getElementById("cityText").textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById("tempValue").textContent = `${Math.round(data.main.temp)}°C`;

    const isDay = isDayTime(data.timezone, data.sys.sunrise, data.sys.sunset);
    const correctIconCode = getCorrectIconCode(data.weather[0].icon, isDay);
    createWeatherIcon(correctIconCode);
    changeBackgroundVideo(correctIconCode);
    updateArchColor(data.main.temp);

    const humidity = data.main.humidity;
    document.getElementById("humidityBox").textContent = `${humidity}%`;
    updateHumidityStatus(humidity);

    document.getElementById("windBox").textContent = `${data.wind.speed} m/s`;

    const uvIndex = calculateUVIndex(data);
    document.getElementById("uvBox").textContent = uvIndex;
    updateUVStatus(uvIndex);

    const visibilityKm = data.visibility ? (data.visibility / 1000).toFixed(1) : 0;
    document.getElementById("visibilityBox").textContent = `${visibilityKm} km`;

    document.getElementById("condition").textContent =
        data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);

    updateDateTimeByTimezone(data);
}

function updateArchColor(temperature) {
    const archInfo = document.querySelector('.arch-info');
    const temp = Math.round(temperature);
    let gradient = '';
    if      (temp >= 40) gradient = 'linear-gradient(135deg, #8B0000, #B22222, #DC143C)';
    else if (temp >= 32) gradient = 'linear-gradient(135deg, #FF4500, #FF6347, #FF7F50)';
    else if (temp >= 25) gradient = 'linear-gradient(135deg, #FFD700, #FFA500, #FF8C00)';
    else if (temp >= 18) gradient = 'linear-gradient(135deg, #32CD32, #3CB371, #2E8B57)';
    else if (temp >= 10) gradient = 'linear-gradient(135deg, #87CEEB, #4682B4, #5F9EA0)';
    else if (temp >= 0)  gradient = 'linear-gradient(135deg, #1E90FF, #0000CD, #00008B)';
    else                 gradient = 'linear-gradient(135deg, #000080, #191970, #4B0082)';
    archInfo.style.background = gradient;
}

function updateHumidityStatus(humidity) {
    const statusEl = document.getElementById("humidityStatus");
    statusEl.className = "condition-status";
    if      (humidity >= 30 && humidity <= 60)                                      { statusEl.textContent = "Healthy";   statusEl.classList.add("healthy");   }
    else if ((humidity >= 20 && humidity < 30) || (humidity > 60 && humidity <= 70)){ statusEl.textContent = "Moderate";  statusEl.classList.add("moderate");  }
    else                                                                             { statusEl.textContent = "Unhealthy"; statusEl.classList.add("unhealthy"); }
}

function updateUVStatus(uvIndex) {
    const statusEl = document.getElementById("uvStatus");
    statusEl.className = "condition-status";
    if      (uvIndex >= 0  && uvIndex <= 2)  { statusEl.textContent = "Low";       statusEl.classList.add("healthy");   }
    else if (uvIndex >= 3  && uvIndex <= 5)  { statusEl.textContent = "Moderate";  statusEl.classList.add("moderate");  }
    else if (uvIndex >= 6  && uvIndex <= 7)  { statusEl.textContent = "High";      statusEl.classList.add("moderate");  }
    else if (uvIndex >= 8  && uvIndex <= 10) { statusEl.textContent = "Very High"; statusEl.classList.add("unhealthy"); }
    else                                     { statusEl.textContent = "Extreme";   statusEl.classList.add("unhealthy"); }
}

let clockInterval;

function updateDateTimeByTimezone(data) {
    const dateTimeEl = document.getElementById("currentDateTime");
    const timezoneOffsetSeconds = data.timezone;

    function updateClock() {
        const nowUTC = Math.floor(Date.now() / 1000);
        const cityTimeSeconds = nowUTC + timezoneOffsetSeconds;
        const cityTime = new Date(cityTimeSeconds * 1000);

        let hours  = cityTime.getUTCHours();
        const minutes = cityTime.getUTCMinutes().toString().padStart(2, '0');
        let ampm = "AM";
        if      (hours === 0)  { hours = 12; }
        else if (hours === 12) { ampm = "PM"; }
        else if (hours > 12)   { hours -= 12; ampm = "PM"; }

        const timeStr = `${hours.toString().padStart(2,'0')}:${minutes} ${ampm}`;
        const daysOfWeek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const months     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const dayName = daysOfWeek[cityTime.getUTCDay()];
        const day     = cityTime.getUTCDate();
        const month   = months[cityTime.getUTCMonth()];
        const year    = cityTime.getUTCFullYear();
        dateTimeEl.textContent = `${dayName}, ${day} ${month} ${year}, ${timeStr}`;
    }

    if (clockInterval) clearInterval(clockInterval);
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function fetchForecast(city, timezone, sunrise, sunset) {
    fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`)
        .then(response => { if (!response.ok) throw new Error('Forecast not found'); return response.json(); })
        .then(data => {
            displayForecastPanels(data, timezone, sunrise, sunset);
            displayTimeOfDayWeather(data, timezone, sunrise, sunset);
        })
        .catch(error => console.error("Error fetching forecast:", error));
}

function createSmallWeatherIcon(iconCode) {
    if      (iconCode === '01d')                                             return '<div class="sun-icon animated"></div>';
    if      (iconCode === '01n')                                             return '<div class="moon-icon"></div>';
    if (['02d','02n','03d','03n','04d','04n'].includes(iconCode))            return '<div class="cloud-icon animated"><div class="cloud"></div></div>';
    if (['09d','09n','10d','10n'].includes(iconCode))                        return `<div class="rain-icon"><div class="rain-cloud"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div><div class="rain-drop"></div></div>`;
    if (['11d','11n'].includes(iconCode))                                    return '<div class="thunder-icon"><div class="thunder-cloud"></div><div class="lightning"></div></div>';
    if (['13d','13n'].includes(iconCode))                                    return `<div class="snow-icon"><div class="snow-cloud"></div><div class="snowflake">❄</div><div class="snowflake">❄</div><div class="snowflake">❄</div></div>`;
    if (['50d','50n'].includes(iconCode))                                    return `<div class="mist-icon"><div class="mist-line"></div><div class="mist-line"></div><div class="mist-line"></div></div>`;
    return '<div class="cloud-icon animated"><div class="cloud"></div></div>';
}

function findClosestForecast(forecasts, targetHour, timezone) {
    let closestForecast = null;
    let closestDiff = Infinity;
    forecasts.forEach(forecast => {
        const forecastDate = new Date((forecast.dt + timezone) * 1000);
        const diff = Math.abs(forecastDate.getUTCHours() - targetHour);
        if (diff < closestDiff) { closestDiff = diff; closestForecast = forecast; }
    });
    return closestForecast;
}

function displayForecastPanels(forecastData, timezone, sunrise, sunset) {
    const panels = [
        document.getElementById("panel1"), document.getElementById("panel2"),
        document.getElementById("panel3"), document.getElementById("panel4"),
        document.getElementById("panel5"), document.getElementById("panel6")
    ];
    const daysOfWeek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const nowUTC = Math.floor(Date.now() / 1000);
    const currentCityDate = new Date((nowUTC + timezone) * 1000);
    const currentDayKey   = currentCityDate.toISOString().split('T')[0];

    const dailyForecasts = {};
    forecastData.list.forEach(item => {
        const forecastDate = new Date((item.dt + timezone) * 1000);
        const dayKey = forecastDate.toISOString().split('T')[0];
        if (!dailyForecasts[dayKey]) {
            dailyForecasts[dayKey] = {
                temps: [], humidity: [], windSpeed: [],
                weather: item.weather[0], icon: item.weather[0].icon,
                date: forecastDate, dt: item.dt
            };
        }
        dailyForecasts[dayKey].temps.push(item.main.temp);
        dailyForecasts[dayKey].humidity.push(item.main.humidity);
        dailyForecasts[dayKey].windSpeed.push(item.wind.speed);
    });

    const dailyArray = Object.entries(dailyForecasts)
        .filter(([key]) => key !== currentDayKey)
        .map(([, value]) => value)
        .slice(0, 6);

    while (dailyArray.length < 6) {
        const lastDay = dailyArray[dailyArray.length - 1];
        if (lastDay) dailyArray.push({
            ...lastDay,
            date: new Date(lastDay.date.getTime() + 86400000),
            dt: lastDay.dt + 86400
        });
    }

    dailyArray.forEach((dayData, index) => {
        if (index < panels.length && dayData) {
            const avgTemp     = Math.round(dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length);
            const avgHumidity = Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length);
            const avgWind     = (dayData.windSpeed.reduce((a, b) => a + b, 0) / dayData.windSpeed.length).toFixed(1);
            const dayName     = daysOfWeek[dayData.date.getUTCDay()];
            const condition   = dayData.weather.description.charAt(0).toUpperCase() + dayData.weather.description.slice(1);

            const forecastMidDayTime = dayData.dt + (12 * 3600);
            const forecastSunrise    = sunrise + ((index + 1) * 86400);
            const forecastSunset     = sunset  + ((index + 1) * 86400);
            const isDay              = forecastMidDayTime >= forecastSunrise && forecastMidDayTime < forecastSunset;
            const correctIconCode    = getCorrectIconCode(dayData.icon, isDay);

            panels[index].innerHTML = `
                <div class="panel-content">
                    <span class="panel-day">${dayName}</span>
                    <div class="panel-icon">${getCustomPanelIcon(correctIconCode)}</div>
                    <span class="panel-temp">${avgTemp}°C</span>
                    <span class="panel-condition">${condition}</span>
                    <span class="panel-humidity"><span class="material-symbols-outlined">humidity_percentage</span>${avgHumidity}%</span>
                    <span class="panel-wind"><span class="material-symbols-outlined">air</span>${avgWind} m/s</span>
                </div>`;
        }
    });
}

// saveToHistory = false prevents auto-searches from polluting history
function fetchWeather(city, saveToHistory = true) {
    clearError();
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`)
        .then(response => { if (!response.ok) throw new Error('City not found'); return response.json(); })
        .then(data => {
            displayWeatherData(data);
            fetchForecast(city, data.timezone, data.sys.sunrise, data.sys.sunset);
            window.currentWeatherData = data;
            if (saveToHistory) addToHistory(city);
        })
        .catch(error => {
            showError(error.message === 'City not found' ? "City not found" : "Something went wrong");
        });
}

function handleSearch() {
    const city = cityInput.value.trim();
    if (!city) { showError("Please enter a city name!"); return; }
    document.getElementById('searchHistoryDropdown').style.display = 'none';
    fetchWeather(city); // saveToHistory defaults to true for manual searches
}

cityInput.addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });

window.addEventListener("DOMContentLoaded", () => {
    // Clean any corrupted history entries (objects instead of strings)
    try {
        let history = JSON.parse(localStorage.getItem('weatherSearchHistory') || '[]');
        history = history.filter(h => typeof h === 'string' && h.trim().length > 0);
        localStorage.setItem('weatherSearchHistory', JSON.stringify(history));
    } catch {
        localStorage.removeItem('weatherSearchHistory');
    }

    fetchWeather("Manila", false); // false = don't save auto-load to history
    initGlobe();
});


// ============================================
// GLOBE
// ============================================

let globe = null;
let globeRotating = true;
let rotationSpeed = 0.15;
let rotationAnimFrame = null;
let currentPOV = { lat: 0, lng: 0, altitude: 2.5 };

const worldCities = [
    { name: "Manila",        country: "PH", lat: 14.5995,  lng: 120.9842,  capital: true  },
    { name: "Tokyo",         country: "JP", lat: 35.6762,  lng: 139.6503,  capital: true  },
    { name: "London",        country: "GB", lat: 51.5074,  lng: -0.1278,   capital: true  },
    { name: "New York",      country: "US", lat: 40.7128,  lng: -74.0060,  capital: false },
    { name: "Paris",         country: "FR", lat: 48.8566,  lng: 2.3522,    capital: true  },
    { name: "Beijing",       country: "CN", lat: 39.9042,  lng: 116.4074,  capital: true  },
    { name: "Moscow",        country: "RU", lat: 55.7558,  lng: 37.6173,   capital: true  },
    { name: "Sydney",        country: "AU", lat: -33.8688, lng: 151.2093,  capital: false },
    { name: "Dubai",         country: "AE", lat: 25.2048,  lng: 55.2708,   capital: false },
    { name: "Singapore",     country: "SG", lat: 1.3521,   lng: 103.8198,  capital: true  },
    { name: "Bangkok",       country: "TH", lat: 13.7563,  lng: 100.5018,  capital: true  },
    { name: "Jakarta",       country: "ID", lat: -6.2088,  lng: 106.8456,  capital: true  },
    { name: "Cairo",         country: "EG", lat: 30.0444,  lng: 31.2357,   capital: true  },
    { name: "Mumbai",        country: "IN", lat: 19.0760,  lng: 72.8777,   capital: false },
    { name: "São Paulo",     country: "BR", lat: -23.5505, lng: -46.6333,  capital: false },
    { name: "Mexico City",   country: "MX", lat: 19.4326,  lng: -99.1332,  capital: true  },
    { name: "Los Angeles",   country: "US", lat: 34.0522,  lng: -118.2437, capital: false },
    { name: "Chicago",       country: "US", lat: 41.8781,  lng: -87.6298,  capital: false },
    { name: "Toronto",       country: "CA", lat: 43.6532,  lng: -79.3832,  capital: false },
    { name: "Berlin",        country: "DE", lat: 52.5200,  lng: 13.4050,   capital: true  },
    { name: "Madrid",        country: "ES", lat: 40.4168,  lng: -3.7038,   capital: true  },
    { name: "Rome",          country: "IT", lat: 41.9028,  lng: 12.4964,   capital: true  },
    { name: "Amsterdam",     country: "NL", lat: 52.3676,  lng: 4.9041,    capital: true  },
    { name: "Seoul",         country: "KR", lat: 37.5665,  lng: 126.9780,  capital: true  },
    { name: "Istanbul",      country: "TR", lat: 41.0082,  lng: 28.9784,   capital: false },
    { name: "Nairobi",       country: "KE", lat: -1.2921,  lng: 36.8219,   capital: true  },
    { name: "Lagos",         country: "NG", lat: 6.5244,   lng: 3.3792,    capital: false },
    { name: "Johannesburg",  country: "ZA", lat: -26.2041, lng: 28.0473,   capital: false },
    { name: "Buenos Aires",  country: "AR", lat: -34.6037, lng: -58.3816,  capital: true  },
    { name: "Lima",          country: "PE", lat: -12.0464, lng: -77.0428,  capital: true  },
    { name: "Karachi",       country: "PK", lat: 24.8607,  lng: 67.0011,   capital: false },
    { name: "Dhaka",         country: "BD", lat: 23.8103,  lng: 90.4125,   capital: true  },
    { name: "Osaka",         country: "JP", lat: 34.6937,  lng: 135.5023,  capital: false },
    { name: "Kuala Lumpur",  country: "MY", lat: 3.1390,   lng: 101.6869,  capital: true  },
    { name: "Tehran",        country: "IR", lat: 35.6892,  lng: 51.3890,   capital: true  },
    { name: "Baghdad",       country: "IQ", lat: 33.3152,  lng: 44.3661,   capital: true  },
    { name: "Riyadh",        country: "SA", lat: 24.7136,  lng: 46.6753,   capital: true  },
    { name: "Athens",        country: "GR", lat: 37.9838,  lng: 23.7275,   capital: true  },
    { name: "Warsaw",        country: "PL", lat: 52.2297,  lng: 21.0122,   capital: true  },
    { name: "Vienna",        country: "AT", lat: 48.2082,  lng: 16.3738,   capital: true  },
    { name: "Stockholm",     country: "SE", lat: 59.3293,  lng: 18.0686,   capital: true  },
    { name: "Oslo",          country: "NO", lat: 59.9139,  lng: 10.7522,   capital: true  },
    { name: "Copenhagen",    country: "DK", lat: 55.6761,  lng: 12.5683,   capital: true  },
    { name: "Helsinki",      country: "FI", lat: 60.1699,  lng: 24.9384,   capital: true  },
    { name: "Lisbon",        country: "PT", lat: 38.7223,  lng: -9.1393,   capital: true  },
    { name: "Brussels",      country: "BE", lat: 50.8503,  lng: 4.3517,    capital: true  },
    { name: "Zurich",        country: "CH", lat: 47.3769,  lng: 8.5417,    capital: false },
    { name: "Prague",        country: "CZ", lat: 50.0755,  lng: 14.4378,   capital: true  },
    { name: "Budapest",      country: "HU", lat: 47.4979,  lng: 19.0402,   capital: true  },
    { name: "Bucharest",     country: "RO", lat: 44.4268,  lng: 26.1025,   capital: true  },
    { name: "Kiev",          country: "UA", lat: 50.4501,  lng: 30.5234,   capital: true  },
    { name: "Minsk",         country: "BY", lat: 53.9045,  lng: 27.5615,   capital: true  },
    { name: "Baku",          country: "AZ", lat: 40.4093,  lng: 49.8671,   capital: true  },
    { name: "Almaty",        country: "KZ", lat: 43.2220,  lng: 76.8512,   capital: false },
    { name: "Tashkent",      country: "UZ", lat: 41.2995,  lng: 69.2401,   capital: true  },
    { name: "Islamabad",     country: "PK", lat: 33.6844,  lng: 73.0479,   capital: true  },
    { name: "New Delhi",     country: "IN", lat: 28.6139,  lng: 77.2090,   capital: true  },
    { name: "Colombo",       country: "LK", lat: 6.9271,   lng: 79.8612,   capital: true  },
    { name: "Kathmandu",     country: "NP", lat: 27.7172,  lng: 85.3240,   capital: true  },
    { name: "Hanoi",         country: "VN", lat: 21.0285,  lng: 105.8542,  capital: true  },
    { name: "Ho Chi Minh City", country: "VN", lat: 10.8231, lng: 106.6297, capital: false },
    { name: "Phnom Penh",    country: "KH", lat: 11.5564,  lng: 104.9282,  capital: true  },
    { name: "Yangon",        country: "MM", lat: 16.8661,  lng: 96.1951,   capital: false },
    { name: "Taipei",        country: "TW", lat: 25.0330,  lng: 121.5654,  capital: true  },
    { name: "Hong Kong",     country: "HK", lat: 22.3193,  lng: 114.1694,  capital: false },
    { name: "Ulaanbaatar",   country: "MN", lat: 47.8864,  lng: 106.9057,  capital: true  },
    { name: "Pyongyang",     country: "KP", lat: 39.0392,  lng: 125.7625,  capital: true  },
    { name: "Kabul",         country: "AF", lat: 34.5553,  lng: 69.2075,   capital: true  },
    { name: "Ankara",        country: "TR", lat: 39.9334,  lng: 32.8597,   capital: true  },
    { name: "Tel Aviv",      country: "IL", lat: 32.0853,  lng: 34.7818,   capital: false },
    { name: "Amman",         country: "JO", lat: 31.9454,  lng: 35.9284,   capital: true  },
    { name: "Damascus",      country: "SY", lat: 33.5138,  lng: 36.2765,   capital: true  },
    { name: "Beirut",        country: "LB", lat: 33.8886,  lng: 35.4955,   capital: true  },
    { name: "Addis Ababa",   country: "ET", lat: 9.0320,   lng: 38.7469,   capital: true  },
    { name: "Khartoum",      country: "SD", lat: 15.5007,  lng: 32.5599,   capital: true  },
    { name: "Accra",         country: "GH", lat: 5.6037,   lng: -0.1870,   capital: true  },
    { name: "Dakar",         country: "SN", lat: 14.7167,  lng: -17.4677,  capital: true  },
    { name: "Casablanca",    country: "MA", lat: 33.5731,  lng: -7.5898,   capital: false },
    { name: "Tunis",         country: "TN", lat: 36.8065,  lng: 10.1815,   capital: true  },
    { name: "Tripoli",       country: "LY", lat: 32.8872,  lng: 13.1913,   capital: true  },
    { name: "Algiers",       country: "DZ", lat: 36.7372,  lng: 3.0869,    capital: true  },
    { name: "Kinshasa",      country: "CD", lat: -4.3276,  lng: 15.3216,   capital: true  },
    { name: "Luanda",        country: "AO", lat: -8.8147,  lng: 13.2302,   capital: true  },
    { name: "Dar es Salaam", country: "TZ", lat: -6.7924,  lng: 39.2083,   capital: false },
    { name: "Kampala",       country: "UG", lat: 0.3476,   lng: 32.5825,   capital: true  },
    { name: "Harare",        country: "ZW", lat: -17.8252, lng: 31.0335,   capital: true  },
    { name: "Cape Town",     country: "ZA", lat: -33.9249, lng: 18.4241,   capital: false },
    { name: "Bogotá",        country: "CO", lat: 4.7110,   lng: -74.0721,  capital: true  },
    { name: "Caracas",       country: "VE", lat: 10.4806,  lng: -66.9036,  capital: true  },
    { name: "Santiago",      country: "CL", lat: -33.4489, lng: -70.6693,  capital: true  },
    { name: "Montevideo",    country: "UY", lat: -34.9011, lng: -56.1645,  capital: true  },
    { name: "Asunción",      country: "PY", lat: -25.2867, lng: -57.6470,  capital: true  },
    { name: "La Paz",        country: "BO", lat: -16.4897, lng: -68.1193,  capital: true  },
    { name: "Quito",         country: "EC", lat: -0.1807,  lng: -78.4678,  capital: true  },
    { name: "Panama City",   country: "PA", lat: 8.9936,   lng: -79.5197,  capital: true  },
    { name: "San José",      country: "CR", lat: 9.9281,   lng: -84.0907,  capital: true  },
    { name: "Ottawa",        country: "CA", lat: 45.4215,  lng: -75.6972,  capital: true  },
    { name: "Vancouver",     country: "CA", lat: 49.2827,  lng: -123.1207, capital: false },
    { name: "Washington DC", country: "US", lat: 38.9072,  lng: -77.0369,  capital: true  },
    { name: "Miami",         country: "US", lat: 25.7617,  lng: -80.1918,  capital: false },
    { name: "Seattle",       country: "US", lat: 47.6062,  lng: -122.3321, capital: false },
    { name: "Auckland",      country: "NZ", lat: -36.8485, lng: 174.7633,  capital: false },
    { name: "Wellington",    country: "NZ", lat: -41.2865, lng: 174.7762,  capital: true  },
    { name: "Canberra",      country: "AU", lat: -35.2809, lng: 149.1300,  capital: true  },
    { name: "Melbourne",     country: "AU", lat: -37.8136, lng: 144.9631,  capital: false },
    { name: "Reykjavik",     country: "IS", lat: 64.1355,  lng: -21.8954,  capital: true  },
];

async function fetchGlobeWeather(lat, lng, locationName) {
    document.getElementById('globeEmptyState').style.display = 'none';
    document.getElementById('globeLoading').style.display   = 'flex';
    ['globeTempBox','globeConditionBox','globeWindBox','globeHumidityBox','globeVisBox'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });

    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`
        );
        if (!response.ok) throw new Error('Weather not found');
        const data = await response.json();

        const cityName = data.name || locationName || 'Unknown Location';
        document.getElementById('globeCity').textContent   = `${cityName}, ${data.sys.country}`;
        document.getElementById('globeCoords').textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;

        document.getElementById('globeTempValue').textContent  = `${Math.round(data.main.temp)}°C`;
        document.getElementById('globeFeelsLike').textContent  = `Feels like ${Math.round(data.main.feels_like)}°C`;

        const condDesc = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
        document.getElementById('globeCondValue').textContent  = condDesc;
        document.getElementById('globeCondDetail').textContent = `Humidity: ${data.main.humidity}%`;

        const iconMap = {
            '01': 'wb_sunny', '02': 'partly_cloudy_day', '03': 'cloud',
            '04': 'cloud',    '09': 'rainy',              '10': 'rainy',
            '11': 'thunderstorm', '13': 'ac_unit',        '50': 'foggy'
        };
        const iconPrefix = data.weather[0].icon.substring(0, 2);
        document.getElementById('globeCondIcon').textContent = iconMap[iconPrefix] || 'wb_sunny';

        document.getElementById('globeWindValue').textContent = `${data.wind.speed} m/s`;
        document.getElementById('globeWindDir').textContent   = `Direction: ${data.wind.deg || '--'}°`;

        document.getElementById('globeHumidValue').textContent = `${data.main.humidity}%`;
        document.getElementById('globePressure').textContent   = `Pressure: ${data.main.pressure} hPa`;

        const visKm = data.visibility ? (data.visibility / 1000).toFixed(1) : '--';
        document.getElementById('globeVisValue').textContent = `${visKm} km`;

        const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const sunset  = new Date(data.sys.sunset  * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        document.getElementById('globeSunrise').textContent = `☀️ ${sunrise} — 🌙 ${sunset}`;

        document.getElementById('globeLoading').style.display = 'none';
        ['globeTempBox','globeConditionBox','globeWindBox','globeHumidityBox','globeVisBox'].forEach(id => {
            document.getElementById(id).style.display = 'flex';
        });

    } catch (e) {
        document.getElementById('globeLoading').style.display = 'none';
        document.getElementById('globeEmptyState').style.display = 'block';
        document.getElementById('globeEmptyState').innerHTML = `
            <div style="font-size:48px;text-align:center;margin-bottom:15px">❌</div>
            <p style="color:rgba(255,255,255,0.7);text-align:center;font-size:14px">
                Could not fetch weather for this location. Try clicking a different area.
            </p>`;
    }
}

function initGlobe() {
    const container = document.getElementById('globeViz');
    if (!container || typeof Globe === 'undefined') return;

    globe = Globe()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('rgba(100, 180, 255, 0.4)')
        .atmosphereAltitude(0.15)
        .labelsData(worldCities)
        .labelLat(d => d.lat)
        .labelLng(d => d.lng)
        .labelText(d => d.name)
        .labelSize(d => d.capital ? 1.2 : 0.8)
        .labelColor(d => d.capital ? 'rgba(255, 240, 100, 0.95)' : 'rgba(200, 230, 255, 0.85)')
        .labelDotRadius(d => d.capital ? 0.4 : 0.25)
        .labelDotOrientation(() => 'bottom')
        .labelResolution(3)
        .labelAltitude(0.01)
        .onGlobeClick(({ lat, lng }) => handleGlobeClick(lat, lng))
        .onLabelClick(d => handleCityLabelClick(d))
        (container);

    globe.pointOfView({ lat: 14.5995, lng: 120.9842, altitude: 2.5 }, 1000);
    currentPOV = { lat: 14.5995, lng: 120.9842, altitude: 2.5 };

    startRotation();
    setupGlobeControls();
    document.addEventListener('keydown', handleGlobeKeyboard);
}

function handleGlobeClick(lat, lng) {
    const wasRotating = globeRotating;
    globeRotating = false;
    globe.pointOfView({ lat, lng, altitude: 1.8 }, 800);
    currentPOV = { lat, lng, altitude: 1.8 };
    document.getElementById('globeCoords').textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    document.getElementById('globeCity').textContent   = 'Fetching location...';
    fetchGlobeWeather(lat, lng, null);
    if (wasRotating) setTimeout(() => { globeRotating = true; }, 3000);
}

function handleCityLabelClick(city) {
    globeRotating = false;
    globe.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.5 }, 1000);
    currentPOV = { lat: city.lat, lng: city.lng, altitude: 1.5 };
    document.getElementById('globeCity').textContent   = `${city.name}, ${city.country}`;
    document.getElementById('globeCoords').textContent = `${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}°`;
    fetchGlobeWeather(city.lat, city.lng, city.name);
    setTimeout(() => { globeRotating = true; }, 4000);
}

function startRotation() {
    if (rotationAnimFrame) cancelAnimationFrame(rotationAnimFrame);
    function rotate() {
        if (globe && globeRotating) {
            const pov = globe.pointOfView();
            globe.pointOfView({ lat: pov.lat, lng: pov.lng + rotationSpeed, altitude: pov.altitude });
        }
        rotationAnimFrame = requestAnimationFrame(rotate);
    }
    rotate();
}

function setupGlobeControls() {
    document.getElementById('globeZoomIn').addEventListener('click', () => {
        const pov = globe.pointOfView();
        const newAlt = Math.max(0.5, pov.altitude - 0.3);
        globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 300);
        currentPOV.altitude = newAlt;
    });
    document.getElementById('globeZoomOut').addEventListener('click', () => {
        const pov = globe.pointOfView();
        const newAlt = Math.min(8, pov.altitude + 0.3);
        globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 300);
        currentPOV.altitude = newAlt;
    });
    document.getElementById('globePauseRotation').addEventListener('click', () => {
        globeRotating = !globeRotating;
        const icon = document.getElementById('pauseIcon');
        icon.textContent = globeRotating ? 'pause' : 'play_arrow';
        document.getElementById('globePauseRotation').title = globeRotating ? 'Pause Rotation' : 'Resume Rotation';
    });

    document.getElementById('globeRotateUp').addEventListener('click',    () => nudgeGlobe(5, 0));
    document.getElementById('globeRotateDown').addEventListener('click',  () => nudgeGlobe(-5, 0));
    document.getElementById('globeRotateLeft').addEventListener('click',  () => nudgeGlobe(0, -10));
    document.getElementById('globeRotateRight').addEventListener('click', () => nudgeGlobe(0, 10));

    let holdInterval = null;
    const arrowActions = {
        globeRotateUp:    () => nudgeGlobe(3, 0),
        globeRotateDown:  () => nudgeGlobe(-3, 0),
        globeRotateLeft:  () => nudgeGlobe(0, -6),
        globeRotateRight: () => nudgeGlobe(0, 6)
    };
    Object.keys(arrowActions).forEach(id => {
        const btn = document.getElementById(id);
        btn.addEventListener('mousedown',  () => { holdInterval = setInterval(arrowActions[id], 80); });
        btn.addEventListener('mouseup',    () => clearInterval(holdInterval));
        btn.addEventListener('mouseleave', () => clearInterval(holdInterval));
    });
}

function nudgeGlobe(latDelta, lngDelta) {
    if (!globe) return;
    const pov    = globe.pointOfView();
    const newLat = Math.max(-80, Math.min(80, pov.lat + latDelta));
    globe.pointOfView({ lat: newLat, lng: pov.lng + lngDelta, altitude: pov.altitude }, 200);
}

function handleGlobeKeyboard(e) {
    const activeTag = document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
    const globeSection = document.getElementById('globeSection');
    if (!globeSection || globeSection.style.display === 'none') return;
    if (!globe) return;
    switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); nudgeGlobe(5, 0);   break;
        case 'ArrowDown':  e.preventDefault(); nudgeGlobe(-5, 0);  break;
        case 'ArrowLeft':  e.preventDefault(); nudgeGlobe(0, -10); break;
        case 'ArrowRight': e.preventDefault(); nudgeGlobe(0, 10);  break;
        case '+': case '=': {
            const pov = globe.pointOfView();
            globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: Math.max(0.5, pov.altitude - 0.3) }, 300);
            break;
        }
        case '-': {
            const pov = globe.pointOfView();
            globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: Math.min(8, pov.altitude + 0.3) }, 300);
            break;
        }
        case ' ':
            e.preventDefault();
            globeRotating = !globeRotating;
            document.getElementById('pauseIcon').textContent = globeRotating ? 'pause' : 'play_arrow';
            break;
    }
}

function toggleGlobeView() {
    const globeSection = document.getElementById('globeSection');
    if (globeSection.style.display === 'none' || globeSection.style.display === '') {
        globeSection.style.display = 'block';
        if (!globe) { setTimeout(initGlobe, 100); }
        else {
            setTimeout(() => {
                if (globe) {
                    const container = document.getElementById('globeViz');
                    globe.width(container.clientWidth);
                    globe.height(container.clientHeight);
                }
            }, 100);
        }
    } else {
        globeSection.style.display = 'none';
    }
}


// ============================================
// KILA CHATBOT
// ============================================

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
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🌤️';

    const typing = document.createElement('div');
    typing.className = 'typing-indicator active';
    typing.innerHTML = '<span></span><span></span><span></span>';

    typingDiv.appendChild(avatar);
    typingDiv.appendChild(typing);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) typingIndicator.remove();
}

async function fetchWeatherDataChat(city) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
        if (!response.ok) throw new Error('City not found');
        return await response.json();
    } catch (error) { return null; }
}

function classifyIntent(message) {
    const m = message.toLowerCase();
    if (/\b(hi|hello|hey|hola|kumusta|good morning|good afternoon|good evening)\b/i.test(m))      return 'greeting';
    if (/\b(thank|thanks|salamat|appreciate|grateful)\b/i.test(m))                                return 'gratitude';
    if (/\b(how are you|how're you|kumusta ka|kamusta|how do you feel)\b/i.test(m))               return 'how_are_you';
    if (/\b(bye|goodbye|see you|paalam|see ya|later)\b/i.test(m))                                 return 'goodbye';
    if (/\b(help|assist|guide|what can you do|capabilities)\b/i.test(m))                          return 'help';
    if (/\b(current|now|today|right now)\b/i.test(m) && /\b(weather|temperature|temp|condition)\b/i.test(m)) return 'weather_current';
    if (/\b(rain|raining|ulan|drizzle|precipitation|shower)\b/i.test(m))                          return 'weather_rain';
    if (/\b(hot|cold|warm|cool|mainit|malamig|temperature|temp)\b/i.test(m))                      return 'weather_temperature';
    if (/\b(humid|humidity|moisture|muggy|dry)\b/i.test(m))                                       return 'weather_humidity';
    if (/\b(wind|windy|breeze|breezy|hangin|gust)\b/i.test(m))                                   return 'weather_wind';
    if (/\b(wear|wearing|clothes|clothing|outfit|damit|jacket|coat)\b/i.test(m))                  return 'advice_clothing';
    if (/\b(umbrella|payong|parasol)\b/i.test(m))                                                 return 'advice_umbrella';
    if (/\b(outdoor|outside|picnic|hike|walk|run|jog|exercise)\b/i.test(m))                      return 'advice_outdoor';
    if (/\b(what is|what are|what's|explain|tell me about|define)\b/i.test(m))                    return 'explanation';
    if (/\b(weather|forecast|panahon|climate|conditions)\b/i.test(m))                             return 'weather_general';
    return 'unknown';
}

async function generateNLPResponse(userMessage) {
    const intent         = classifyIntent(userMessage);
    const hasWeatherData = window.currentWeatherData;
    await new Promise(resolve => setTimeout(resolve, 300));

    conversationHistory.push({ role: 'user', message: userMessage, intent });
    if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);

    let response = '';
    switch (intent) {
        case 'greeting':
            response = ["Hey there! ☀️ I'm Kila, your weather buddy! What would you like to know about the weather today? 🌈","Hi! 🌤️ Great to see you! I'm here to help with all your weather questions!","Hello! 👋 I'm Kila! Ready to help you plan your day with weather info! ☀️"][Math.floor(Math.random()*3)];
            break;
        case 'gratitude':
            response = ["You're so welcome! 🌈 Happy to help anytime!","My pleasure! 😊 Stay safe out there! 🌤️","Anytime! 💙 Feel free to ask me anything! ⛅"][Math.floor(Math.random()*3)];
            break;
        case 'how_are_you':
            response = "I'm doing fantastic! ☀️ Just like a perfect sunny day! How can I help you today? 🌈";
            break;
        case 'goodbye':
            response = "Take care! 👋 Stay weather-aware and have a great day! ☀️";
            break;
        case 'help':
            response = `I'm Kila, your weather assistant! 🌤️ I can help with:\n🌡️ Current temperature\n🌧️ Rain predictions\n💨 Wind speed\n💧 Humidity\n☀️ Weather in any city\n👕 What to wear\n☔ Umbrella advice\n\nTry: "Weather in Tokyo" 🌍`;
            break;
        case 'weather_current':
            if (hasWeatherData) {
                const d = window.currentWeatherData;
                response = `Right now in ${d.name}, it's ${Math.round(d.main.temp)}°C with ${d.weather[0].description}! 🌤️\nFeels like ${Math.round(d.main.feels_like)}°C, ${d.main.humidity}% humidity, winds ${d.wind.speed} m/s 💨`;
            } else response = "Search for a city above to see current weather! 🌍";
            break;
        case 'weather_rain':
            if (hasWeatherData) {
                const d    = window.currentWeatherData;
                const desc = d.weather[0].description.toLowerCase();
                if      (desc.includes('rain') || desc.includes('drizzle')) response = `Yes! It's raining in ${d.name}! 🌧️ Grab an umbrella! ☔`;
                else if (desc.includes('cloud'))                             response = `Not raining in ${d.name}, but ${desc}. Humidity ${d.main.humidity}% — maybe bring an umbrella just in case! ⛅`;
                else                                                         response = `No rain in ${d.name} right now! ☀️ It's ${desc} — no umbrella needed! 🌈`;
            } else response = "Tell me a city to check rain! Try 'Weather in Paris' 🌍";
            break;
        case 'weather_temperature':
            if (hasWeatherData) {
                const d    = window.currentWeatherData;
                const temp = Math.round(d.main.temp);
                const desc = temp > 30 ? "It's HOT! 🔥" : temp > 25 ? "Warm! ☀️" : temp > 20 ? "Comfortable! 😊" : temp > 15 ? "Cool! 🍃" : "Cold! ❄️";
                response = `${desc}\n${d.name} is ${temp}°C, feels like ${Math.round(d.main.feels_like)}°C`;
            } else response = "Which city? Try 'Weather in London' 🌍";
            break;
        case 'weather_humidity':
            if (hasWeatherData) {
                const d = window.currentWeatherData;
                const h = d.main.humidity;
                response = `Humidity in ${d.name} is ${h}%! ${h > 80 ? "Very muggy! 💦" : h > 60 ? "Moderately humid! 💧" : h > 40 ? "Comfortable! ✨" : "Pretty dry! 🌵"}`;
            } else response = "Ask me about humidity in any city! 🌍";
            break;
        case 'weather_wind':
            if (hasWeatherData) {
                const d = window.currentWeatherData;
                const w = d.wind.speed;
                response = `Wind speed in ${d.name} is ${w} m/s! ${w > 10 ? "It's windy! 🌪️ Secure loose items!" : w > 5 ? "Nice breeze! 💨 Good for outdoors!" : "Calm! 🍃"}`;
            } else response = "Which city should I check wind for? 🌍";
            break;
        case 'advice_clothing':
            if (hasWeatherData) {
                const d    = window.currentWeatherData;
                const temp = Math.round(d.main.temp);
                response = getClothingAdvice(temp) + `\nCurrent temp in ${d.name}: ${temp}°C 👕`;
            } else response = "Tell me your city and I'll suggest what to wear! 🌍";
            break;
        case 'advice_umbrella':
            if (hasWeatherData) {
                const d    = window.currentWeatherData;
                const desc = d.weather[0].description.toLowerCase();
                if      (desc.includes('rain') || desc.includes('drizzle')) response = `YES! Bring an umbrella! ☔ It's raining in ${d.name}! 🌧️`;
                else if (d.main.humidity > 70)                              response = `Not raining but ${d.main.humidity}% humidity — bring one just in case! ⛅`;
                else                                                        response = `No umbrella needed in ${d.name}! ☀️ Enjoy the ${desc}! 🌈`;
            } else response = "Tell me your city to check! Try 'Weather in Seattle' ☔";
            break;
        case 'advice_outdoor':
            if (hasWeatherData) {
                const d    = window.currentWeatherData;
                const temp = Math.round(d.main.temp);
                const desc = d.weather[0].description.toLowerCase();
                let advice;
                if      (desc.includes('rain') || desc.includes('storm')) advice = "Not ideal for outdoors! 🌧️ Consider indoor activities!";
                else if (temp > 30)                                        advice = "Hot outside! 🔥 Stay hydrated, use sunscreen, go early morning or evening!";
                else if (temp < 10)                                        advice = "Cold! ❄️ Bundle up if heading out! ☕";
                else                                                       advice = `Perfect for outdoors! ☀️ ${temp}°C with ${desc} — get out there! 🏃`;
                response = `${advice}\nConditions in ${d.name}: ${temp}°C, ${desc} 🌤️`;
            } else response = "Tell me your city for outdoor advice! 🌍";
            break;
        default:
            response = "I'm your weather assistant Kila! 🌤️\nTry:\n• 'What's the weather like?'\n• 'Weather in Tokyo'\n• 'Should I bring an umbrella?'\n\nWhat would you like to know? 🌈";
    }
    return response;
}

function getClothingAdvice(temp) {
    if (temp > 30) return "Wear light, breathable clothing! Shorts, t-shirts, sandals! 🩳👕";
    if (temp > 25) return "Light summer clothes are perfect! 👗👔";
    if (temp > 20) return "A light shirt works great! Maybe a light jacket! 👕🧥";
    if (temp > 15) return "Long sleeves and pants recommended! A jacket would help! 👖🧥";
    if (temp > 10) return "Wear a jacket! It's getting cold! 🧥❄️";
    return "Bundle up! Heavy jacket, warm clothes, maybe a scarf! 🧣🧥";
}

function extractCityFromMessage(message) {
    const patterns = [
        /weather (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
        /(?:what's|whats|what is) (?:the )?weather (?:like )?(?:in|at) ([a-z\s]+?)(?:\?|$)/i,
        /temperature (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
        /forecast (?:in|at|for) ([a-z\s]+?)(?:\?|$)/i,
        /how (?:is|are) (?:the )?(?:weather|conditions) (?:in|at) ([a-z\s]+?)(?:\?|$)/i
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
    if (iconCode.startsWith('03') || iconCode.startsWith('04')) return '☁️';
    if (iconCode.startsWith('09') || iconCode.startsWith('10')) return '🌧️';
    if (iconCode.startsWith('11')) return '⛈️';
    if (iconCode.startsWith('13')) return '❄️';
    if (iconCode.startsWith('50')) return '🌫️';
    return '🌤️';
}

function createWeatherCard(data) {
    const emoji       = getWeatherEmoji(data.weather[0].icon);
    const temp        = Math.round(data.main.temp);
    const feelsLike   = Math.round(data.main.feels_like);
    const description = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
    return `
        <div class="weather-card">
            <div class="weather-icon">${emoji}</div>
            <h3>${data.name}, ${data.sys.country}</h3>
            <h3>${description}</h3>
            <div class="weather-info">
                <div class="weather-info-row"><span>🌡️ Temperature:</span><strong>${temp}°C</strong></div>
                <div class="weather-info-row"><span>🤔 Feels like:</span><strong>${feelsLike}°C</strong></div>
                <div class="weather-info-row"><span>💧 Humidity:</span><strong>${data.main.humidity}%</strong></div>
                <div class="weather-info-row"><span>💨 Wind:</span><strong>${data.wind.speed} m/s</strong></div>
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

            const temp      = Math.round(weatherData.main.temp);
            const condition = weatherData.weather[0].description;
            const humidity  = weatherData.main.humidity;
            let insight     = `The weather in ${cityName} is `;
            if      (temp > 30) insight += `quite hot at ${temp}°C! 🔥 Stay hydrated! `;
            else if (temp > 25) insight += `warm and pleasant at ${temp}°C! ☀️ `;
            else if (temp > 20) insight += `comfortable at ${temp}°C! 😊 `;
            else if (temp > 15) insight += `cool at ${temp}°C! 🍃 `;
            else                insight += `chilly at ${temp}°C! 🧥 `;
            if      (condition.includes('rain'))  insight += `It's raining — grab an umbrella! ☔`;
            else if (condition.includes('cloud')) insight += `Cloudy skies! ⛅`;
            else if (condition.includes('clear')) insight += `Clear skies — perfect day! ☀️`;
            if (humidity > 70) insight += ` Humidity is ${humidity}%, might feel muggy! 💦`;

            hideTypingIndicator();
            addMessage(insight, false);
        } else {
            addMessage(`Hmm, I couldn't find "${cityName}" on my weather radar! 🌍 Check the spelling or try a different city!`, false);
        }
    } else {
        const response = await generateNLPResponse(message);
        hideTypingIndicator();
        if (response) addMessage(response, false);
    }
}

function sendSuggestion(text) { chatInput.value = text; sendMessage(); }
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}