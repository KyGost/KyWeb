const templateString = `
<template>
  <div class="dialog">
    <h2 class="dialogTitle"></h2>
    <p class="dialogNotes"></p>
    <div class="dialogInputs">
    </div>
    <div class="dialogExtraInfo"></div>
    <p class="found"></p>
    <div class="dialogButtons">
      <button class="dialogDone">Done</button><button class="dialogCancel">Cancel</button>
    </div>
  </div>
</template>
`;
export default new DOMParser()
	.parseFromString(templateString, "text/html")
	.querySelector("template");
