function is_valid_exam_url(url) {
  const regex =
    /^https:\/\/exam\.global-exam\.com\/training\/activity\/\d+\/content\/\d+$/;
  return regex.test(url);
}

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!is_valid_exam_url(details.url)) return;

    const filter = browser.webRequest.filterResponseData(details.requestId);
    let chunks = [];

    filter.ondata = (event) => {
      chunks.push(event.data);
      filter.write(event.data);
    };

    filter.onstop = async () => {
      const blob = new Blob(chunks);
      const text = await blob.text();
      try {
        const data = JSON.parse(text);
        await process_exam_questions(data);
      } catch (e) {
        console.error(e);
      }
      filter.close();
    };
  },
  { urls: ["https://exam.global-exam.com/training/*"] },
  ["blocking"],
);

async function process_exam_questions(data) {
  await browser.storage.local.set({ 
    currentExamData: data 
  });
  
  const targetUrl = browser.extension.getURL("exam_data.html");
  
  // Check if the tab is already open
  const tabs = await browser.tabs.query({ url: targetUrl });
  
  if (tabs.length > 0) {
    // If it's open, just focus it (the content will update via storage listener)
    await browser.tabs.update(tabs[0].id, { active: true });
  } else {
    // If not, create a new tab
    await browser.tabs.create({ url: targetUrl });
  }
}
