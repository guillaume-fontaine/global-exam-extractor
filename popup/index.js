const disableElement = document.getElementById("disable");
const autoValidateElement = document.getElementById("auto-validate");
const autoFinishElement = document.getElementById("auto-finish");
const debugElement = document.getElementById("debug");
const showExamDataButton = document.getElementById("show-exam-data");

const DEFAULT_SETTINGS = {
  disable: true,
  autoValidate: false,
  autoFinish: false,
  debug: false,
};

async function loadSettings() {
  const data = await browser.storage.sync.get(DEFAULT_SETTINGS);
  disableElement.checked = data.disable;
  autoValidateElement.checked = data.autoValidate;
  autoFinishElement.checked = data.autoFinish;
  debugElement.checked = data.debug;
  
  const localData = await browser.storage.local.get({ popupAnswers: [] });
  await displayAnswers(localData.popupAnswers);
}

async function displayAnswers(answers) {
  const list = document.getElementById("answers-list");
  if (!list) return;
  list.innerHTML = "";
  if (!answers || answers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucune réponse trouvée";
    list.appendChild(li);
    return;
  }

  let domLabels = [];
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const response = await browser.tabs.sendMessage(tabs[0].id, {
        action: "getLabels",
        ids: answers.map(a => a.id)
      });
      if (response && response.labels) {
        domLabels = response.labels;
      }
    }
  } catch (e) {
    console.log("Could not get labels from DOM", e);
  }

  if (domLabels.length > 0) {
    domLabels.forEach(label => {
      const li = document.createElement("li");
      li.textContent = label;
      list.appendChild(li);
    });
  } else {
    answers.forEach((ans) => {
      const li = document.createElement("li");
      let content = ans.text || ans.content || ans.label || ans.value || ans.id;
      const temp = document.createElement("div");
      temp.innerHTML = content;
      li.textContent = temp.textContent.trim() || ans.id;
      list.appendChild(li);
    });
  }
}

async function addEventsListeners() {
  disableElement.addEventListener("change", async (e) => {
    await browser.storage.sync.set({ disable: disableElement.checked });
  });
  autoValidateElement.addEventListener("change", async (e) => {
    await browser.storage.sync.set({
      autoValidate: autoValidateElement.checked,
    });
  });
  autoFinishElement.addEventListener("change", async (e) => {
    await browser.storage.sync.set({
      autoFinish: autoFinishElement.checked,
    });
  });
  debugElement.addEventListener("change", async (e) => {
    await browser.storage.sync.set({ debug: debugElement.checked });
  });


  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.popupAnswers) {
      displayAnswers(changes.popupAnswers.newValue);
    }
  });
}

async function main() {
  await loadSettings();
  await addEventsListeners();
}

main();
