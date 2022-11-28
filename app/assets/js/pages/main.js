import * as tools from "../tools.js";
import {showNotification} from "../tools.js";

const {clipboard, ipcRenderer, shell} = require('electron');

let lastClicked = null, contextElement = null;
let specificSettings = {}

// TODO: Comment
document.onclick = function (e) {
    lastClicked = e.target;

    let context = document.getElementById("contextMenu");
    if (context.classList.contains("show") && lastClicked.closest("#contextMenu") === null) {
        context.classList.remove("show");
        contextElement = null;
    }
}

// TODO: Comment
function removeActiveListItems() {
    let ul = document.querySelector(".listBox ul");
    let actives = ul.querySelectorAll("li.active");
    if (actives) {
        for (let active of actives) {
            let id = active.getAttribute("data-id");

            delete specificSettings[id];
            active.remove();
        }
    }

    if (ul.scrollHeight > ul.clientHeight) ul.style.width = "calc(100% + 10px)";
    else ul.style.width = "100%";

    tools.updateSelected();
}

// TODO: Comment
tools.bindEvent("click", ".input .add-button:not([aria-disabled='true'])", function () {
    let input = this.closest(".input").querySelector("input");

    if (tools.addLinkToList(input.value)) input.value = "";
});

// TODO: Comment
tools.bindEvent("click", ".listBox:not([aria-disabled='true']) ul", function (e) {
    if (e.target === this) {
        let actives = document.querySelectorAll(".listBox li.active");

        for (let active of actives)
            active.classList.remove("active");

        tools.updateSelected();
    }
});

// TODO: Comment
tools.bindEvent("click", ".listBox:not([aria-disabled='true']) li", function (e) {
    let listBox = this.closest(".listBox");
    let actives = listBox.querySelectorAll("li.active");

    if (!e.ctrlKey && !e.shiftKey) {
        for (let active of actives) {
            if (active !== this) active.classList.remove("active");
        }
    }

    if (e.shiftKey && actives.length) {
        document.getSelection().removeAllRanges();

        let elements = listBox.querySelectorAll("li");
        let active = false, clicked = false;

        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];

            if (element === this) {
                clicked = true;
            }

            if (element.classList.contains("active")) {
                active = true;
            }

            if ((active && !clicked) || (clicked && !active)) {
                element.classList.add("active");
            } else if (active && clicked) {
                this.classList.add("active");
                break;
            }
        }
    } else {
        if (this.classList.contains("active")) this.classList.remove("active");
        else this.classList.add("active");
    }

    tools.updateSelected();
});

// TODO: Comment
tools.bindEvent("click", ".listBox .delete-button:not([aria-disabled='true'])", function () {
    removeActiveListItems();
});

// TODO: Comment
tools.bindEvent("click", ".input .paste-button:not([aria-disabled='true'])", function () {
    let clipboardText = clipboard.readText();

    if (!clipboardText) {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["noClipboard"]);
    } else tools.addLinkToList(clipboardText);
});

// TODO: Comment
tools.bindEvent("click", "#updateNotification .close-button", function () {
    let notification = document.getElementById("updateNotification");
    notification.classList.add('hidden');
});

// TODO: Comment
tools.bindEvent("click", "#updateNotification .restart-button", function () {
    ipcRenderer.send('restart_app');
});

// TODO: Comment
tools.bindEvent("keydown", ".input input:not([aria-disabled='true'])", function (e) {
    if (e.code === "Enter") {
        tools.addLinkToList(this.value);
    }
});

/*
 * Funktion: Anonym
 * Autor: Bernardo de Oliveira
 *
 * Ändert das Design-Attribut und ändert somit auch das Design
 */
tools.bindEvent("click", ".theme-toggler", function () {
    let html = document.getElementsByTagName("html")[0];
    let togglers = document.getElementsByClassName("theme-toggler");

    if (html.getAttribute("data-theme") === "dark") {
        html.setAttribute("data-theme", "light");

        for (let toggler of togglers) {
            let icon = toggler.querySelector("svg");
            icon.classList.remove("fa-sun");
            icon.classList.add("fa-moon");
        }

        tools.setTheme("light");
    } else {
        html.setAttribute("data-theme", "dark");

        for (let toggler of togglers) {
            let icon = toggler.querySelector("svg");
            icon.classList.remove("fa-moon");
            icon.classList.add("fa-sun");
        }

        tools.setTheme("dark");
    }
});

// TODO: Comment
tools.bindEvent("click", ".startAbort .start-button:not([aria-disabled='true'])", async function () {
    let listBox = document.getElementsByClassName("listBox")[0];
    let location = document.querySelector(".location #location");
    let items = listBox.querySelectorAll("li");

    let mode = tools.getCookie("mode");
    let codecAudio = tools.getCookie("codecAudio");
    let codecVideo = tools.getCookie("codecVideo");
    let quality = tools.getCookie("quality");

    if (!items.length) {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["noURLs"]);

        if (document.hidden)
            ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["noURLs"]);

        return;
    }

    if (!mode) {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["downloadMode"]);

        if (document.hidden)
            ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["downloadMode"]);

        return;
    } else if (mode === "audio") {
        if (!codecAudio) {
            showNotification(tools.languageDB[tools.selectedLang]["js"]["codec"]);

            if (document.hidden)
                ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["codec"]);

            return;
        }

        if (!quality) {
            showNotification(tools.languageDB[tools.selectedLang]["js"]["quality"]);

            if (document.hidden)
                ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["quality"]);

            return;
        }
    } else {
        if (!codecVideo) {
            showNotification(tools.languageDB[tools.selectedLang]["js"]["codec"]);

            if (document.hidden)
                ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["codec"]);

            return;
        }
    }

    if (!location.value) {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["storageLocation"]);

        if (document.hidden)
            ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["storageLocation"]);

        return;
    }

    tools.setDisabled();
    ipcRenderer.send('set_percentage', 0);
    ipcRenderer.send('add_abort');

    let progressTotal = document.querySelector(".progress-total progress");
    let infoTotal = document.querySelector(".progress-total .info p");
    let progressSong = document.querySelector(".progress-song progress");
    let infoSong = document.querySelector(".progress-song .info p");

    progressTotal.value = 0;
    progressSong.value = 0;
    infoTotal.textContent = "0%";
    infoSong.textContent = "0%";

    let count = 0;
    let allUrls = [];
    for (let item of items) {
        if (item.textContent.includes("playlist?list=")) {
            let urls = await tools.getPlaylistUrls(item.textContent);
            count += urls.length;
            allUrls = [...allUrls, ...urls];
        } else {
            count++;
            allUrls.push(item.textContent);
        }
    }

    let percentage = Math.floor(100 / count * 100) / 100;
    let aborted = false;
    let i = 0;
    for (let url of allUrls) {
        let individualLocation = location.value;
        let individualQuality = quality;
        let individualMode = mode;
        let individualCodecAudio = codecAudio;
        let individualCodecVideo = codecVideo;

        if (!url.includes("netflix")) {
            if (typeof specificSettings[i] !== 'undefined') {
                if (typeof specificSettings[i]["quality"] !== 'undefined')
                    individualQuality = specificSettings[i]["quality"];

                if (typeof specificSettings[i]["mode"] !== 'undefined')
                    individualMode = specificSettings[i]["mode"];

                if (typeof specificSettings[i]["codecAudio"] !== 'undefined')
                    individualCodecAudio = specificSettings[i]["codecAudio"];

                if (typeof specificSettings[i]["codecVideo"] !== 'undefined')
                    individualCodecVideo = specificSettings[i]["codecVideo"];

                if (typeof specificSettings[i]["location"] !== 'undefined')
                    individualLocation = specificSettings[i]["location"];
            }

            let qualityInt = 0;
            switch (individualQuality) {
                case "best": qualityInt = 0;
                    break;
                case "medium": qualityInt = 5;
                    break;
                case "bad": qualityInt = 9;
                    break;
            }

            url = await tools.checkPremiumAndConvert(url);

            aborted = !await tools.downloadYTURL(
                individualMode,
                individualLocation,
                url,
                percentage,
                individualCodecAudio,
                individualCodecVideo,
                qualityInt
            );
        } else {
            aborted = await tools.downloadNFURL(
            );
        }
        if (aborted) break;

        i++;
    }

    infoTotal.textContent = "100%";
    progressTotal.value = 1;
    ipcRenderer.send('set_percentage', 1);

    tools.setEnabled();

    if (!aborted) {
        ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["success"], tools.languageDB[tools.selectedLang]["js"]["songsDownloaded"]);
    } else {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["downloadAborted"]);

        if (document.hidden)
            ipcRenderer.send('show_notification', tools.languageDB[tools.selectedLang]["js"]["error"], tools.languageDB[tools.selectedLang]["js"]["downloadAborted"]);
    }

    ipcRenderer.send('remove_abort');
});

// TODO: Comment
tools.bindEvent("click", ".startAbort .abort-button:not([aria-disabled='true'])", function () {
    tools.abortDownload();
    tools.getChildProcessRecursive(tools.childProcess.pid).then(function (pids) {
        pids = pids.reverse();
        for (let pid of pids) {
            ipcRenderer.send("kill_pid", Number(pid));
        }
        ipcRenderer.send("kill_pid", tools.childProcess.pid);
    });
    tools.setEnabled();
});

// TODO: Comment
tools.bindEvent("contextmenu", ".listBox:not([aria-disabled='true']) li", function (e) {
    e.preventDefault();

    if (!e.target.textContent.includes("playlist?list=")) {
        let context = document.getElementById("contextMenu");
        let mode = tools.getCookie("mode");
        let id = this.getAttribute("data-id");

        if (typeof specificSettings[id] !== 'undefined' && typeof specificSettings[id]["mode"] !== 'undefined')
            mode = specificSettings[id]["mode"];

        tools.removeActives(context.querySelector(".mode"));
        if (mode === "audio") {
            context.querySelector(".codecAudio").style.display = "";
            context.querySelector(".quality").style.display = "";

            context.querySelector(".codecVideo").style.display = "none";

            context.querySelector(".mode [data-value='audio']").classList.add("active");
        } else {
            context.querySelector(".codecAudio").style.display = "none";
            context.querySelector(".quality").style.display = "none";

            context.querySelector(".codecVideo").style.display = "";

            context.querySelector(".mode [data-value='video']").classList.add("active");
        }

        tools.removeActives(context.querySelector(".quality"));
        if (typeof specificSettings[id] !== 'undefined' && typeof specificSettings[id]["quality"] !== "undefined") {
            context.querySelector(".quality [data-value='" + specificSettings[id]["quality"] + "']").classList.add("active");
        } else {
            let quality = tools.getCookie("quality");
            context.querySelector(".quality [data-value='" + quality+ "']").classList.add("active");
        }

        tools.removeActives(context.querySelector(".codecAudio"));
        if (typeof specificSettings[id] !== 'undefined' && typeof specificSettings[id]["codec"] !== "undefined") {
            context.querySelector(".codecAudio [data-value='" + specificSettings[id]["codec"] + "']").classList.add("active");
        } else {
            let codec = tools.getCookie("codecAudio");
            context.querySelector(".codecAudio [data-value='" + codec + "']").classList.add("active");
        }

        contextElement = e.target;
        context.classList.add("show");

        context.style.left = e.pageX + "px";
        context.style.top = e.pageY + "px";

        let contextBounding = context.getBoundingClientRect();
        if (contextBounding.right > document.body.clientWidth) {
            context.style.left = contextBounding.left + (document.body.clientWidth - contextBounding.left - contextBounding.width - 10) + "px";
        }

        this.classList.add("active");
        tools.updateSelected();
    } else {
        showNotification(tools.languageDB[tools.selectedLang]["js"]["playlistContext"]);
    }
});

// TODO: Comment
tools.bindEvent("mouseover", "#contextMenu .nav-select", function () {
    let select = this.querySelector(".select");
    let contextMenu = this.closest("#contextMenu");
    let left = contextMenu.getBoundingClientRect().width;

    select.classList.add("show");
    select.style.left = left - 5 + "px";

    let selectBounding = select.getBoundingClientRect();
    if (selectBounding.right > document.body.clientWidth) {
        select.style.left = "-" + (selectBounding.width - 5) + "px"
    }

    this.addEventListener("mouseleave", function mouseleave() {
        select.classList.remove("show");

        this.removeEventListener("mouseleave", mouseleave);
    });
});

// TODO: Comment
tools.bindEvent("click", "#contextMenu .nav-select .option:not(.active)", function () {
    let navSelect = this.closest(".nav-select");
    let className = navSelect.classList[0];

    let actives = document.querySelectorAll(".listBox li.active");
    for (let active of actives) {
        let id = active.getAttribute("data-id");

        if (typeof specificSettings[id] === 'undefined')
            specificSettings[id] = {};

        specificSettings[id][className] = this.getAttribute("data-value");
    }

    let activeOptions = navSelect.querySelectorAll(".active");
    for (let activeOption of activeOptions) {
        activeOption.classList.remove("active");
    }

    this.classList.add("active");

    if (navSelect.classList.contains("mode")) {
        let context = document.getElementById("contextMenu");
        let audioSettings = context.querySelectorAll(".audioSettings");
        let videoSettings = context.querySelectorAll(".videoSettings");

        if (this.getAttribute("data-value") === "audio") {
            videoSettings.forEach(function (element) {
                element.style.display = "none";
            });
            audioSettings.forEach(function (element) {
                element.style.display = "";
            });
        } else {
            audioSettings.forEach(function (element) {
                element.style.display = "none";
            });
            videoSettings.forEach(function (element) {
                element.style.display = "";
            });
        }
    }
});

// TODO: Comment
tools.bindEvent("click", "#contextMenu .copy", function () {
    tools.activeToClipboard();

    this.closest("#contextMenu").classList.remove("show");
});

// TODO: Comment
tools.bindEvent("click", "#contextMenu .location", function () {
    ipcRenderer.send('open_file_dialog');

    ipcRenderer.on("selected_file", function specificLocation(event, path) {
        let actives = document.querySelectorAll(".listBox li.active");
        if (!actives.length) actives[actives.length] = contextElement;

        for (let active of actives) {
            let id = active.getAttribute("data-id");

            if (typeof specificSettings[id] !== "object")
                specificSettings[id] = {};

            specificSettings[id]["location"] = path;
        }

        showNotification("Specific location has been set.");
        ipcRenderer.off("selected_file", specificLocation);
    });

    this.closest("#contextMenu").classList.remove("show");
});

// TODO: Comment
tools.bindEvent("click", ".location .search-button:not([aria-disabled='true'])", function () {
    ipcRenderer.send('open_file_dialog');

    // TODO: Comment
    ipcRenderer.on("selected_file", function mainLocation(event, path) {
        let location = document.querySelector(".location #location");
        let locationButton = document.querySelector(".location .location-button");

        location.value = path;
        locationButton.ariaDisabled = "false";

        this.off("selected_file", mainLocation);
    });
});

// TODO: Comment
tools.bindEvent("click", ".location .location-button:not([aria-disabled='true'])", function () {
    let location = document.querySelector(".location #location");

    if (location.value) shell.openPath(location.value);
});

// TODO: Comment
tools.bindEvent("click", "#settings-open:not([aria-disabled='true'])", async function () {
    let settings = document.getElementsByTagName("settings")[0];

    if (settings.innerHTML === "") {
        await tools.loadPage("assets/template/settings.html", settings, () => {
            tools.loadSettings();
            tools.setThemeIcon();
        });
    }

    let body = document.getElementsByTagName("body")[0];

    body.style.overflow = "hidden";
    settings.style.display = "initial";
    settings.animateCallback([
        {top: "100%"},
        {top: "0%"}
    ], {
        duration: 200,
        fill: "forwards"
    }, function () {
        body.style.overflow = "";

        let nav = document.querySelector("settings #nav");
        nav.classList.add("static");
    });
});

// TODO: Comment
ipcRenderer.on('download', function () {
    document.querySelector(".startAbort .start-button").click();
});

// TODO: Comment
ipcRenderer.on('abort', function () {
    document.querySelector(".startAbort .abort-button").click();
});

// TODO: Comment
ipcRenderer.on('url', function (event, value) {
    let input = document.querySelector(".input input");
    input.value = value;

    if (tools.addLinkToList(value))
        input.value = "";
});

// TODO: Comment
ipcRenderer.on('translate', function (event, array) {
    let value = [];
    let language = tools.languageDB[tools.selectedLang];

    let i = 0;
    for (let arrayLevels of array) {
        let tmpLanguage = language;

        for (let arrayLevel of arrayLevels) {
            value[i] = tmpLanguage[arrayLevel];
            tmpLanguage = tmpLanguage[arrayLevel];
        }
        i++;
    }

    ipcRenderer.send("translation", value);
});

// TODO: Comment
document.addEventListener("keydown", function (e) {
    if (e.code === "Delete") {
        removeActiveListItems();
    }

    if (e.code === "KeyA" && e.ctrlKey && lastClicked.closest(".listBox") !== null) {
        let items = document.querySelectorAll(".listBox li");
        if (!items.length) return;

        setTimeout(() => {
            document.getSelection().removeAllRanges();
        });

        for (let item of items) {
            item.classList.add("active");
        }

        let linkCount = document.getElementById("link-count");
        linkCount.querySelector("a").textContent = items.length.toString();
        linkCount.style.opacity = "1";
    }

    if (e.code === "KeyC" && e.ctrlKey) {
        tools.activeToClipboard();
    }
});