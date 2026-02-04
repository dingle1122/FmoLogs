<script setup>
import ToastContainer from './components/common/ToastContainer.vue'
import ConfirmDialog from './components/common/ConfirmDialog.vue'
</script>

<template>
  <RouterView />
  <ToastContainer />
  <ConfirmDialog />
</template>

<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100%;
}
</style>
