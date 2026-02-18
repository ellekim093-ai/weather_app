const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const humidity = document.getElementById("humidity");
const condition = document.getElementById("condition");
const errorMsg = document.getElementById("errorMsg");

 
// api key for openweathermap kapag luma na pwede tayong mag create or gumawa ng bagong api ng walang bayad to sya
// so next naman pang buong mundo na yung hahanapin natin kunwari sa london, type mo lang london malaking letra muna una tapos, comma, malaking letra naman sa panghuli dahil yung standard para sa openweathermap api ganun yung format ng pag search ng city, tapos yung country code naman is PH kasi yung target natin is philippines pero pwede rin naman ibang country code kung gusto mo

const apiKey = "2e3d2d2d9957fd5364e42c6cf4fe73e5";

searchBtn.addEventListener("click", () => {

  const city = cityInput.value.trim();

  if (city === "") {
    errorMsg.textContent = "Please enter a city name!";
    return;
  }



 // ito kasi ibig sabihin ito yung standard natin na url para makuha natin yung data sa openweathermap api, yung city na ipapasok ng user at yung api key natin
  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},PH&units=metric&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {

        // Get weather condition from API
const weatherMain = data.weather[0].main.toLowerCase(); // "Clouds", "Rain", etc.

// Remove previous background classes
document.body.classList.remove("sunny", "clouds", "rain", "snow");

// Apply new background class
if (weatherMain.includes("cloud")) {
    
  document.body.classList.add("clouds");
} else if (weatherMain.includes("rain") || weatherMain.includes("drizzle") || weatherMain.includes("thunderstorm")) {
  document.body.classList.add("rain");
} else if (weatherMain.includes("snow")) {
  document.body.classList.add("snow");
} else if (weatherMain.includes("clear")) {
  document.body.classList.add("sunny");
} else {
  // default background
  document.body.style.background = "#a3cef1";
}


      console.log(data); // IMPORTANT DEBUG

      // ito kasi ibig sabihin kapag hindi nahanap yung city na ipinasok ng user, magpapakita siya ng error message na "City not found"
      // at error handling din ito kasi kapag may ibang error na nangyari sa pag fetch ng data, magpapakita siya ng "Something went wrong"
      if (data.cod !== 200) {

        errorMsg.textContent = "City not found";
        return;
      }

      // ito kasi ibig sabihin, ito yung DOM manipulation natin para ipakita yung data na nakuha natin sa API sa ating webpage, tapos nilalagay din natin yung errorMsg.textContent sa empty string para mawala yung error message kapag successful yung pag fetch ng data
      // ibig sabihin, kapag successful yung pag fetch ng data, mawawala yung error message at ipapakita yung city name, temperature, humidity, at condition sa webpage
      errorMsg.textContent = "";
      cityName.textContent = data.name;
      temperature.textContent = `Temperature: ${data.main.temp} °C`;
      humidity.textContent = `Humidity: ${data.main.humidity} %`;
      condition.textContent = `Condition: ${data.weather[0].description}`;
    })

    .catch(() => {

      errorMsg.textContent = "Something went wrong";
    });
});