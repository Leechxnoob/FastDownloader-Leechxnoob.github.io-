import mustache from "./lib/mustache.min.js";

const NP = require('number-precision');
const {promisify} = require('util');
const ytpl = require('ytpl');
const {ipcRenderer, clipboard} = require('electron');
const {exec} = require('child_process');
const execSync = promisify(require('child_process').exec);

let theme = getCookie("theme");

if (!theme) theme = "light";
setCookie("theme", theme);

document.getElementsByTagName("html")[0].setAttribute("data-theme", theme);

let __realDir = null;
let hiddenElements = [], urlList = [], processedUrls = [];

export let specificSettings = {};

export let worker = new Worker("assets/js/lib/worker.js");
export let workers = 0;

export let downloading = false, aborted = false;
export let childProcess = null, selectedLang = null;
export let languageDB = {};

// TODO: Comment
HTMLElement.prototype.animateCallback = function (keyframes, options, callback) {
    let animation = this.animate(keyframes, options);

    animation.onfinish = function () {
        callback();
    }
}

/*
 * Funktion: bindEvent()
 * Autor: Bernardo de Oliveira
 * Argumente:
 *  eventNames: (String) Event-Name z.B. click
 *  selector: (String) Den Element-Selector z.B. die ID oder Klasse usw.
 *  handler: (Object) Die Funktion welche ausgeführt werden soll
 *
 * Ist das Äquivalent zu .on(eventNames, selector, handler) in jQuery
 */
export function bindEvent (eventNames, selectors, handler) {
    eventNames.split(', ').forEach((eventName) => {
        document.addEventListener(eventName, function (event) {
            selectors.split(', ').forEach((selector) => {
                if (event.target.matches(selector + ', ' + selector + ' *')) {
                    let element = event.target.closest(selector);
                    handler.apply(element, arguments);
                }
            });
        }, false);
    });
}

// TODO: Comment
worker.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
        case "checkPremiumAndAdd":
            processedUrls.push(msg.data);
            workers--;

            if (!workers) download(processedUrls).then(() => {
                let progressTotal = document.querySelector(".progress-total progress");
                let infoTotal = document.querySelector(".progress-total .info p");

                infoTotal.textContent = "100%";
                progressTotal.value = 1;
                ipcRenderer.send('set_percentage', 1);

                setEnabled();

                downloading = false;
                processedUrls = [];

                if (!aborted) {
                    ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["success"], languageDB[selectedLang]["js"]["songsDownloaded"]);
                } else {
                    showNotification(languageDB[selectedLang]["js"]["downloadAborted"]);

                    if (document.hidden)
                        ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["error"], languageDB[selectedLang]["js"]["downloadAborted"]);
                }

                ipcRenderer.send('remove_abort');
            });
            break;
        case "checkPremium":
            let li = document.querySelector("ul li[data-url='" + msg.old + "']");

            if (urlList.indexOf(msg.url) !== -1) {
                alreadyInList();
                li.remove();

                return;
            }

            li.textContent = msg.url;
            urlList.push(msg.url);

            break;
    }
});

// TODO: Comment
export function setRealDir(dirname) {
    if (process.platform !== "win32") {
        if (dirname.includes("/app.asar")) dirname = dirname.replace("/app.asar", "");
        if (!dirname.includes("/resources")) dirname = dirname + "/resources";
    } else {
        if (dirname.includes("\\app.asar")) dirname = dirname.replace("\\app.asar", "");
        if (!dirname.includes("\\resources")) dirname = dirname + "\\resources";
    }

    __realDir = dirname;
}

/*
 * Funktion: getCookie()
 * Autor: Bernardo de Oliveira
 * Argumente:
 *  name: (String) Cookie Name
 *
 * Holt den Wert aus dem Speicher
 * Gibt den Wert zurück
 */
export function getCookie(name) {
    let cookie = localStorage.getItem(name);

    return cookie === 'true' ? true :
        cookie === 'false' ? false :
            cookie === 'null' ? null : cookie;
}

/*
 * Funktion: setCookie()
 * Autor: Bernardo de Oliveira
 * Argumente:
 *  name: (String) Cookie Name
 *  value: (String) Cookie Wert
 *  expiresAt: (String) Auslaufdatum vom Cookie
 *
 * Erstellt einen Cookie und setzt die Werte
 */
export function setCookie(name, value) {
    localStorage.setItem(name, value);
}

export function setAborted(bool) {
    aborted = bool;
}

export function setWorkerCount(count) {
    workers = count;
}

// TODO: Comment
export function removeActives(element) {
    let actives = element.querySelectorAll(".active");
    for (let active of actives) {
        active.classList.remove("active");
    }
}

// TODO: Comment
export function updateSelected() {
    let actives = document.querySelectorAll(".listBox li.active");
    let linkCount = document.getElementById("link-count");

    if (actives.length) {
        linkCount.style.opacity = "1";
        linkCount.querySelector("a").textContent = actives.length.toString();
    } else linkCount.style.opacity = "0";
}

// TODO: Comment
export function activeToClipboard() {
    let actives = document.querySelectorAll(".listBox li.active");
    let clipText = "";

    for (let active of actives)
        clipText += active.textContent + "\n";

    clipboard.writeText(clipText);
}

// TODO: Comment
export function loadAllData() {
    let data = JSON.parse(getCookie("cache"));
    setCookie("cache", null);

    document.getElementById("location").value = data["location"];

    let listBox = document.querySelector(".listBox ul");
    for (let listItem of data["listItems"]) {
        let li = document.createElement("li");
        li.textContent = listItem;

        listBox.appendChild(li);
    }
}

// TODO: Comment
export function getAllData() {
    let data = {};
    let listItems = document.querySelectorAll(".listBox ul li");

    data["listItems"] = [];
    for (let listItem of listItems) {
        data["listItems"].push(listItem.textContent);
    }

    data["location"] = document.getElementById("location").value;

    setCookie("cache", JSON.stringify(data));
}

// TODO: Comment
function alreadyInList() {
    showNotification(languageDB[selectedLang]["js"]["urlInList"]);

    if (document.hidden)
        ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["error"], languageDB[selectedLang]["js"]["urlInList"]);
}

// TODO: Comment
async function download(data) {
    let percentage = Math.floor(100 / data.length * 100) / 100;
    downloading = true;

    for (let item of data) {
        if (!item.url.includes("netflix")) {
            aborted = !await downloadYTURL(
                item.mode,
                item.location,
                item.url,
                percentage,
                item.codecAudio,
                item.codecVideo,
                item.quality
            );
        } else {
            aborted = await downloadNFURL(
            );
        }
        if (aborted) break;
    }
}

export function addUrlToList(url = "") {
    if (!url) {
        showNotification(languageDB[selectedLang]["js"]["noURL"]);

        if (document.hidden)
            ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["error"], languageDB[selectedLang]["js"]["noURL"]);

        return false;
    }

    let values = url.split(/[\n\s]+/);
    let ul = document.querySelector(".listBox ul");
    for (let value of values) {
        value = value.trim();

        let url = [];

        url["yt"] = match(value, "http(?:s?):\\/\\/(?:www\\.|music\\.)?youtu(?:be\\.com\\/watch\\?v=|be\\.com\\/playlist\\?list=|\\.be\\/)([\\w\\-\\_]*)(&(amp;)?‌​[\\w\\?‌​=]*)?");

        // TODO: Complete regex for netflix
        url["nf"] = match(value, "http(?:s?):\\/\\/(?:www\\.)?netflix.com");

        if (!url["yt"] && !url["nf"]) {
            showNotification(languageDB[selectedLang]["js"]["noValidURL"]);

            if (document.hidden)
                ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["error"], languageDB[selectedLang]["js"]["noValidURL"]);

            return false;
        }

        if (urlList.indexOf(url["yt"]) !== -1 || urlList.indexOf(url["nf"]) !== -1) {
            alreadyInList();

            return false;
        }

        let finalUrl = url["yt"] ?? url["nf"];

        let li = document.createElement("li");
        li.textContent = finalUrl

        let nextID = ul.querySelectorAll("li").length;
        li.setAttribute("data-id", nextID.toString());
        li.setAttribute("data-url", finalUrl)

        ul.appendChild(li);

        if (url["yt"]) {
            worker.postMessage({
                type: "loadPremiumAndMode",
                premium: getCookie("premium"),
                mode: getCookie("mode")
            });
            worker.postMessage({type: "checkPremium", url: url["yt"]});
        }
    }

    if (ul.scrollHeight > ul.clientHeight) ul.style.width = "calc(100% + 10px)";
    else ul.style.width = "100%";

    ul.scrollTop = ul.scrollHeight;

    showNotification(languageDB[selectedLang]["js"]["urlAdded"]);

    if (document.hidden)
        ipcRenderer.send('show_notification', languageDB[selectedLang]["js"]["error"], languageDB[selectedLang]["js"]["urlAdded"]);

    return true;
}

// TODO: Comment
export function removeActiveListItems() {
    let ul = document.querySelector(".listBox ul");
    let actives = ul.querySelectorAll("li.active");
    if (actives) {
        for (let active of actives) {
            let id = active.getAttribute("data-id");
            delete specificSettings[id];

            let index = urlList.indexOf(active.textContent);
            delete urlList[index];

            active.remove();
        }
    }

    if (ul.scrollHeight > ul.clientHeight) ul.style.width = "calc(100% + 10px)";
    else ul.style.width = "100%";

    updateSelected();
}

/*
 * Funktion: showNotification()
 * Autor: Bernardo de Oliveira
 * Argumente:
 *  message: (String) Definiert die Nachricht in der Benachrichtigung
 *  time: (Integer) Definiert wie lange die Benachrichtigung angezeigt werden soll
 *
 * Animiert eine Benachrichtigung in die Anzeige
 * Wenn der Player angezeigt wird, wird die Benachrichtigung drüber angezeigt, sonst ganz unten
 */
export function showNotification(message, time = 3000) {
    let body = document.getElementsByTagName("body")[0];

    let notifications = document.getElementsByClassName("notification");
    for (let notification of notifications) {
        let notificationStyle = window.getComputedStyle(notification);
        let notificationPosition = notification.getBoundingClientRect();

        let bottom = Number(notificationStyle.bottom.replace("px", ""));
        notification.style.bottom = bottom + notificationPosition.height + 5 + "px";
    }

    let notification = document.createElement("div");
    notification.classList.add("notification");

    notification.textContent = message;
    notification.style.left = "10px";

    body.appendChild(notification);

    let timeoutOpacity;

    notification.animateCallback([{opacity: 0}, {opacity: 1}], {
        duration: 100, fill: "forwards"
    }, function () {
        timeoutOpacity = setTimeout(() => {
            removeOpacityNotification(notification);
        }, time);
    });

    notification.onmouseover = function () {
        clearTimeout(timeoutOpacity);
    }

    notification.onmouseout = function () {
        removeOpacityNotification(notification);
    }
}

/*
 * Funktion: removeOpacityNotification()
 * Autor: Bernardo de Oliveira
 * Argumente:
 *  notification: (Object) Definiert die Benachrichtigung
 *
 * Entfernt die Sichtbarkeit von einer Benachrichtigung
 * Entfernt die Benachrichtigung nach Schluss
 */
function removeOpacityNotification(notification) {
    notification.animateCallback([{opacity: 1}, {opacity: 0}], {
        duration: 100, fill: "forwards"
    }, function () {
        notification.remove();
    });
}

// TODO: Comment
function match(string, regex) {
    let regExp = new RegExp(regex, "gi");
    let found = string.match(regExp);

    return (found) ? found[0] : null;
}

// TODO: Comment
export function selectClick(element) {
    let select = element;
    let body = document.getElementsByTagName("body")[0];

    if (!element.classList.contains("select")) {
        select = element.closest(".select");
    }

    let label = select.previousElementSibling;

    if (select.classList.contains("active")) {
        select.classList.remove("active");

        if (select.classList.contains("top")) {
            select.classList.remove("top");
            label.style.opacity = "1";
        }


        for (let element of hiddenElements) {
            element.style.opacity = "1";
            element.style.pointerEvents = "";
        }

        hiddenElements = [];
    } else {
        let options = select.querySelectorAll(".option");
        let option = options[0];

        let computedStyle = window.getComputedStyle(option, null);
        let optionHeight = getNumber(computedStyle.height) + getNumber(computedStyle.padding) * 2;

        let optionCount = options.length;
        let optionsHeight = optionHeight * optionCount;
        optionsHeight = optionsHeight > 100 ? 100 : optionsHeight;

        let clientRectSelect = select.getClientRects()[0];
        let clientRectBody = body.getClientRects()[0];

        if ((clientRectBody.height - 20) - clientRectSelect.bottom < optionsHeight) {
            select.classList.add("top");
            label.style.opacity = "0";
        }

        let nextElement = select.parentElement;
        let height = 0;

        let interval = setInterval(function () {
            let row = nextElement.closest(".row");
            if (row) nextElement = row;

            if (select.classList.contains("top")) {
                nextElement = nextElement.previousElementSibling;
            } else {
                nextElement = nextElement.nextElementSibling;
            }

            if (nextElement) {
                let rect = nextElement.getBoundingClientRect();
                let style = getComputedStyle(nextElement);

                height += rect.height;

                if (style.opacity !== "0")
                    hiddenElements.push(nextElement);

                if (height > 100) {
                    clearInterval(interval);
                    for (let element of hiddenElements) {
                        element.style.opacity = "0";
                        element.style.pointerEvents = "none";
                    }
                }
            } else {
                clearInterval(interval);
                for (let element of hiddenElements) {
                    element.style.opacity = "0";
                    element.style.pointerEvents = "none";
                }
            }
        });

        select.classList.add("active");
    }
}

// TODO: Comment
export function hideSelect(element) {
    let select = element;
    if (!element.classList.contains("select")) {
        select = element.closest(".select");
    }

    select.classList.remove("active");
    select.classList.remove("top");
}

// TODO: Comment
export function downloadNFURL() {

}

// TODO: Comment
function downloadYTURL(mode, location, url, percentage, codecAudio, codecVideo, quality) {
    return new Promise((resolve) => {
        let fileEnding = "";
        if (process.platform === "win32") fileEnding = ".exe";

        let progressTotal = document.querySelector(".progress-total progress");
        let infoTotal = document.querySelector(".progress-total .info p");
        let progressSong = document.querySelector(".progress-song progress");
        let infoSong = document.querySelector(".progress-song .info p");

        let command = "\"" + __realDir + "/yt-dlp" + fileEnding + "\" -f ";
        if (mode === "audio") {
            command += "bestaudio --ffmpeg-location \"" + __realDir + "/ffmpeg" + fileEnding + "\" --extract-audio --audio-format " + codecAudio + " --audio-quality " + quality + " ";

            if (["mp3", "aac", "flac"].includes(codecAudio)) command += "--embed-thumbnail ";
        } else {
            command += "bestvideo+bestaudio -S vcodec:" + codecVideo + " --ffmpeg-location \"" + __realDir + "/ffmpeg" + fileEnding + "\" --embed-thumbnail --audio-format mp3 --audio-quality 9 --merge-output-format mp4 ";
        }

        let premium = JSON.parse(getCookie("premium"));
        if (premium["check"]) {
            if (premium["browser"] !== "") {
                command += "--cookies-from-browser " + premium["browser"] + " ";
            } else {
                showNotification(languageDB[selectedLang]["js"]["noBrowser"]);
                resolve(false);
            }
        }

        if (getCookie("artistName")) {
            command += "--add-metadata -o \"" + location + "/%(creator)s - %(title)s.%(ext)s\" " + url;
        } else {
            command += "--add-metadata -o \"" + location + "/%(title)s.%(ext)s\" " + url;
        }

        childProcess = exec(command);

        let found;
        childProcess.stdout.on('data', function (data) {
            found = data.match("(?<=\\[download\\])(?:\\s+)(\\d+(\\.\\d+)?%)");
            if (found) {
                progressSong.value = Number(found[1].replace("%", "")) / 100;
                infoSong.textContent = found[1];
            }
        });

        childProcess.on('close', function () {
            let percentageTotal = NP.round(progressTotal.value * 100 + percentage, 2);
            let percentageDecimal = percentageTotal / 100;

            progressTotal.value = percentageDecimal;
            infoTotal.textContent = percentageTotal + "%";

            progressSong.value = 1;
            infoSong.textContent = "100%";

            ipcRenderer.send('set_percentage', percentageDecimal);

            if (!aborted) {
                resolve(true);
            } else {
                resolve(false);
                aborted = false;
            }
        });
    });
}

// TODO: Comment
export async function getPlaylistUrls(url) {
    let playlist = await ytpl(url, {
        limit: Infinity,
        pages: Infinity
    });

    let items = [];

    for (let item of playlist["items"])
        items.push(item["shortUrl"]);

    return items;
}

// TODO: Comment
export function setDisabled() {
    let listBox = document.getElementsByClassName("listBox")[0];
    let location = document.querySelector(".location #location");
    let buttons = document.querySelectorAll("button:not(.abort-button):not(.location-button):not(.theme-toggler)");
    let abortButton = document.querySelector(".abort-button");
    let input = document.querySelector("input:not(#location)");

    listBox.ariaDisabled = "true";
    location.ariaDisabled = "true";
    input.ariaDisabled = "true";
    input.setAttribute("readonly", "readonly");

    for (let button of buttons)
        button.ariaDisabled = "true";

    abortButton.ariaDisabled = "false";
}

// TODO: Comment
export function setEnabled() {
    let listBox = document.getElementsByClassName("listBox")[0];
    let location = document.querySelector(".location #location");
    let buttons = document.querySelectorAll("button:not(.abort-button):not(.location-button):not(.theme-toggler)");
    let abortButton = document.querySelector(".abort-button");
    let input = document.querySelector("input:not(#location)");

    listBox.ariaDisabled = "false";
    location.ariaDisabled = "false";
    input.ariaDisabled = "false";
    input.removeAttribute("readonly");

    for (let button of buttons)
        button.ariaDisabled = "false";

    abortButton.ariaDisabled = "true";
}

// TODO: Comment
export async function getChildProcessRecursive(ppid) {
    let output = [], tempOutput;
    if (process.platform === "win32") {
        tempOutput = await execSync("wmic process where (ParentProcessId=" + ppid + ") get ProcessId");
    } else {
        tempOutput = await execSync("pgrep -P " + ppid).catch(() => {
        });
        if (!tempOutput) tempOutput = [];
    }

    if (Object.keys(tempOutput).length) {
        tempOutput = [...tempOutput["stdout"].matchAll("\\d+")];
    }

    for (let i = 0; i < tempOutput.length; i++) {
        output[i] = Number(tempOutput[i][0]);
    }

    for (let pid of output) {
        tempOutput = await getChildProcessRecursive(pid);
        if (Array.isArray(tempOutput)) {
            output = [...tempOutput, ...output];
        }
    }

    return output;
}

// TODO: Comment
export function selectOption(option) {
    let select = option.closest(".select");
    let button = select.querySelector("div");

    let selected = select.querySelector("[aria-selected='true']");
    selected.ariaSelected = "false";
    option.ariaSelected = "true";

    button.textContent = option.textContent;
    select.setAttribute("data-value", option.getAttribute("data-value"));

    toggleVisibility();
}

// TODO: Comment
function toggleVisibility() {
    let mode = document.querySelector("settings .mode .select");
    let value = mode.getAttribute("data-value");

    let audioSettings = document.querySelectorAll("settings .audioSettings");
    let videoSettings = document.querySelectorAll("settings .videoSettings");

    if (value === "audio") {
        videoSettings.forEach(function (element) {
            element.style.display = "";
        });

        audioSettings.forEach(function (element) {
            element.style.display = "block";
        });
    } else {
        audioSettings.forEach(function (element) {
            element.style.display = "";
        });
        videoSettings.forEach(function (element) {
            element.style.display = "block";
        });
    }
}

// TODO: Comment
export function saveSettings() {
    let save = document.querySelector("settings #save");

    if (save.classList.contains("active")) {
        let mode = document.querySelector("settings .mode .select");
        let quality = document.querySelector("settings .quality .select");
        let codecAudio = document.querySelector("settings .codecAudio .select");
        let codecVideo = document.querySelector("settings .codecVideo .select");
        let closeToTray = document.querySelector("settings #closeToTray");
        let autostart = document.querySelector("settings #autostart");
        let artistName = document.querySelector("settings #artistName");
        let premiumCheck = document.querySelector("settings #premium");
        let premiumBrowser = document.querySelector("settings #browser");

        setCookie("mode", mode.getAttribute("data-value"));
        setCookie("quality", quality.getAttribute("data-value"));
        setCookie("codecAudio", codecAudio.getAttribute("data-value"));
        setCookie("codecVideo", codecVideo.getAttribute("data-value"));
        setCookie("save", true);
        setCookie("closeToTray", closeToTray.classList.contains("active"));
        setCookie("autostart", autostart.classList.contains("active"));
        setCookie("artistName", artistName.classList.contains("active"));
        setCookie("premium", JSON.stringify({
            "browser": premiumBrowser.getAttribute("data-value"),
            "check": premiumCheck.classList.contains("active")
        }));
    }
}

// TODO: Comment
export function deleteSettings() {
    setCookie("mode", "");
    setCookie("quality", "");
    setCookie("codecAudio", "");
    setCookie("codecVideo", "");
    setCookie("save", false);
    setCookie("closeToTray", false);
    setCookie("autostart", false);
    setCookie("premium", JSON.stringify({"browser": null, "check": false}));
    setCookie("artistName", false);
}

// TODO: Comment
export function loadSettings() {
    let mode = document.querySelector("settings .mode .select");
    let quality = document.querySelector("settings .quality .select");
    let codecAudio = document.querySelector("settings .codecAudio .select");
    let codecVideo = document.querySelector("settings .codecVideo .select");
    let lang = document.querySelector("settings .lang .select");

    let modeValue = getCookie("mode");
    let qualityValue = getCookie("quality");
    let codecAudioValue = getCookie("codecAudio");
    let codecVideoValue = getCookie("codecVideo");
    let langValue = getCookie("lang");
    let save = getCookie("save");
    let closeToTray = getCookie("closeToTray");
    let autostart = getCookie("autostart");
    let premium = JSON.parse(getCookie("premium"));
    let artistName = getCookie("artistName");

    let option;
    if (modeValue) {
        option = mode.querySelector("[data-value='" + modeValue + "']");
        selectOption(option);
    }

    if (qualityValue) {
        option = quality.querySelector("[data-value='" + qualityValue + "']");
        selectOption(option);
    }

    if (codecAudioValue) {
        option = codecAudio.querySelector("[data-value='" + codecAudioValue + "']");
        selectOption(option);
    }

    if (codecVideoValue) {
        option = codecVideo.querySelector("[data-value='" + codecVideoValue + "']");
        selectOption(option);
    }

    if (langValue) {
        option = lang.querySelector("[data-value='" + langValue + "']");
        selectOption(option);
    }

    let saving = document.querySelector("settings .save");
    if (save) {
        saving.querySelector("#save").classList.add("active");
        saving.querySelector("span").textContent = languageDB[selectedLang]["js"]["on"];
    } else {
        saving.querySelector("span").textContent = languageDB[selectedLang]["js"]["off"];
    }

    let closingToTray = document.querySelector("settings .closeToTray");
    if (closeToTray) {
        closingToTray.querySelector("#closeToTray").classList.add("active");
        closingToTray.querySelector("span").textContent = languageDB[selectedLang]["js"]["on"];
    } else {
        closingToTray.querySelector("span").textContent = languageDB[selectedLang]["js"]["off"];
    }

    let autostarting = document.querySelector("settings .autostart");
    if (autostart) {
        autostarting.querySelector("#autostart").classList.add("active");
        autostarting.querySelector("span").textContent = languageDB[selectedLang]["js"]["on"];
    } else {
        autostarting.querySelector("span").textContent = languageDB[selectedLang]["js"]["off"];
    }

    let artistNaming = document.querySelector("settings .artistName");
    if (artistName) {
        artistNaming.querySelector("#artistName").classList.add("active");
        artistNaming.querySelector("span").textContent = languageDB[selectedLang]["js"]["on"];
    } else {
        artistNaming.querySelector("span").textContent = languageDB[selectedLang]["js"]["off"];
    }

    let premiumCheck = document.querySelector("settings .premium");
    let premiumBrowser = document.querySelector("settings .browser");

    if (premium && typeof premium != "undefined" && (premium["check"] ?? false)) {
        premiumCheck.querySelector("#premium").classList.add("active");
        premiumCheck.querySelector("span").textContent = languageDB[selectedLang]["js"]["on"];

        if (typeof premium["browser"] != 'undefined' && premium["browser"] != null) {
            option = premiumBrowser.querySelector("[data-value='" + premium["browser"] + "']");
            selectOption(option);
        }
    } else {
        premiumCheck.querySelector("span").textContent = languageDB[selectedLang]["js"]["off"];
    }
}

// TODO: Comment
export async function initialize() {
    if (!Object.keys(languageDB).length) {
        await fetch("assets/db/language.json").then(response => {
            return response.json();
        }).then(jsonData => languageDB = jsonData);
    }

    let cookie = getCookie("lang");
    let lang = null;
    if (cookie) {
        lang = cookie;
    } else {
        for (let language of navigator.languages) {
            if (typeof languageDB[language] !== "undefined")
                lang = language;
        }
        if (!lang) lang = "en";

        setCookie("lang", lang);
    }
    selectedLang = lang;

    let main = document.getElementsByTagName("main")[0];
    await loadPage("assets/template/main.html", main, () => {
        setThemeIcon();
    });

    //loadSettings();
}

// TODO: Comment
export async function loadPage(pageURL, element, callback = () => {
}) {
    await fetch(pageURL).then(response => {
        return response.text();
    }).then(htmlData => {
        let template = new DOMParser().parseFromString(htmlData, 'text/html').body;

        let scripts = template.getElementsByTagName("script");
        scripts = Object.assign([], scripts);

        for (let script of scripts) {
            let scriptTag = document.createElement("script");
            scriptTag.type = "module";
            scriptTag.src = script.src;

            element.appendChild(scriptTag);

            script.parentElement.removeChild(script);
        }

        element.innerHTML += mustache.render(template.innerHTML, languageDB[selectedLang]);
        callback();
    });
}

// TODO: Comment
export function setThemeIcon() {
    setTimeout(function () {
        let icons = document.querySelectorAll(".theme-toggler svg");
        for (let icon of icons) {
            if (theme === "light") icon.classList.add("fa-moon");
            else icon.classList.add("fa-sun");
        }
    }, 500);
}

// TODO: Comment
function getNumber(string) {
    return Number((string).match(/\d+/));
}

// TODO: Comment
export function setTheme(themeSet) {
    theme = themeSet;
    setCookie("theme", themeSet);
}

// TODO: Comment
function addLeadingZero(string, size) {
    let count = Number(size) - string.toString().length;

    for (let i = 0; i < count; i++)
        string = "0" + string;

    return string;
}

// TODO: Comment
export async function loadInfo() {
    let dynamic = document.querySelector("#info #dynamic");

    await fetch("https://api.github.com/repos/BERNARDO31P/FastDownloader/releases?per_page=10").then(response => {
        return response.json();
    }).then(htmlData => {
        for (let tag of htmlData) {
            let date = new Date(tag.published_at);
            let day = addLeadingZero(date.getUTCDate(), 2);
            let month = addLeadingZero(date.getUTCMonth() + 1, 2);
            let year = addLeadingZero(date.getUTCFullYear(), 4);

            let title = document.createElement("h3");
            title.textContent = tag.tag_name + " - " + day + "." + month + "." + year;

            dynamic.appendChild(title);

            let infos = tag.body.split("\r\n");
            infos = infos.filter(n => n);

            let infoBox = document.createElement("div");
            for (let info of infos) {
                let infoText = document.createElement("p");
                infoText.textContent = info;

                infoBox.appendChild(infoText);
            }

            dynamic.appendChild(infoBox);
        }
    });
}