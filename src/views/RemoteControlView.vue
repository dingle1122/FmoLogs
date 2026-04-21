<template>
  <div class="remote-control-view">
    <AprsRemoteControl :active-address-id="activeAddressId" :address-list="addressList" />
  </div>
</template>

<script setup>
import AprsRemoteControl from '../components/home/modals/AprsRemoteControl.vue'

defineProps({
  activeAddressId: {
    type: String,
    default: null
  },
  addressList: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.remote-control-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
}
</style>
