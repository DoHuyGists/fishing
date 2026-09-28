<template>
    <div class="flex flex-col">
        <template v-for="item in items">
            <div class="flex gap-2">
                <input type="checkbox" name="" id="">
                <div>{{ item.category }}</div>
            </div>
        </template>
    </div>
</template>
<script lang="ts" setup>
import { items } from '../../data/items';



</script>