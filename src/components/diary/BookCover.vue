<script lang="ts" setup>
import { computed } from 'vue'

export type BookVariant = 'default' | 'ocean' | 'gold' | 'dark' | 'emerald'

export interface BookProps {
  /** Tiêu đề hiển thị trên gáy sách và bìa */
  title?: string
  /** Tên tác giả / chủ sở hữu */
  author?: string
  /** Số / Ký hiệu góc trên (Xoay 90 độ) */
  numUp?: string | number
  /** Số / Ký hiệu góc dưới (Xoay 90 độ) */
  numDown?: string | number
  /** Theme màu sắc có sẵn: 'default' | 'ocean' | 'gold' | 'dark' | 'emerald' */
  variant?: BookVariant
  /** Override màu nền/gradient bìa sách tùy chỉnh */
  coverBg?: string
  /** Override màu gáy sách tùy chỉnh */
  spineBg?: string
  /** Override màu chữ tùy chỉnh */
  textColor?: string
  /** Tỷ lệ thu phóng kích thước (Default: 1) */
  scale?: number
}

const props = withDefaults(defineProps<BookProps>(), {
  title: '1984',
  author: 'George Orwell',
  numUp: '84',
  numDown: '1',
  variant: 'default',
  scale: 1,
})

const VARIANT_PRESETS: Record<BookVariant, { coverBg: string; spineBg: string; textColor: string }> = {
  default: {
    coverBg: 'linear-gradient(45deg, #DAD5DC 0%, #f2ebf4 100%)',
    spineBg: 'rgba(232, 229, 234, 1)',
    textColor: '#2b2b2b',
  },
  ocean: {
    coverBg: 'linear-gradient(45deg, #102a43 0%, #243b53 50%, #334e68 100%)',
    spineBg: '#091e36',
    textColor: '#f0f4f8',
  },
  gold: {
    coverBg: 'linear-gradient(45deg, #785208 0%, #f7c948 100%)',
    spineBg: '#5c3d02',
    textColor: '#1f1601',
  },
  dark: {
    coverBg: 'linear-gradient(45deg, #18181b 0%, #3f3f46 100%)',
    spineBg: '#09090b',
    textColor: '#f4f4f5',
  },
  emerald: {
    coverBg: 'linear-gradient(45deg, #064e3b 0%, #10b981 100%)',
    spineBg: '#022c22',
    textColor: '#ecfdf5',
  },
}

const styleVars = computed(() => {
  const preset = VARIANT_PRESETS[props.variant] || VARIANT_PRESETS.default
  return {
    '--book-cover-bg': props.coverBg || preset.coverBg,
    '--book-spine-bg': props.spineBg || preset.spineBg,
    '--book-text-color': props.textColor || preset.textColor,
    '--book-scale': props.scale,
  }
})
</script>

<template>
  <div class="book-container" :style="styleVars">
    <div class="book">
      <div class="front">
        <div class="cover">
          <p class="num-up">{{ numUp }}</p>
          <slot name="cover-icon">
            <svg
              id="eye-left"
              xmlns="http://www.w3.org/2000/svg"
              width="75"
              height="100"
              version="1.0"
            >
              <path
                d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                id="text2161"
                fill="currentColor"
                fill-opacity="1"
                stroke="none"
                stroke-width=".72233355px"
                stroke-linecap="butt"
                stroke-linejoin="miter"
                stroke-opacity="1"
              />
            </svg>
            <svg
              id="eye-right"
              xmlns="http://www.w3.org/2000/svg"
              width="75"
              height="100"
              version="1.0"
            >
              <path
                d="m 72.520861,60.915859 v 0 C 69.385207,53.011396 61.908243,46.570093 55.74346,42.387465 49.578631,38.204905 40.408101,36.818968 33.679899,37.051071 c -1.597953,0.05517 -2.931531,0.451253 -4.000736,1.188245 -0.738155,0.570053 -1.097854,1.127016 -1.079089,1.670881 0.02949,0.854739 0.93486,2.69053 2.716108,5.507379 0.805175,1.372521 1.234574,2.83577 1.288193,4.389751 0.131362,3.807345 -0.983571,6.879734 -3.344801,9.217182 -2.361227,2.337476 -5.686459,3.580206 -9.975699,3.728183 C 15.162859,62.894893 11.580282,61.559887 8.5361375,58.747669 5.4920363,55.935482 3.8975877,52.431474 3.7527937,48.235627 c -0.1769131,-5.1282 2.0835359,-9.776522 6.7813483,-13.944986 4.697855,-4.168379 11.041643,-6.390426 19.031387,-6.666142 8.662566,-0.298838 16.811229,2.201105 24.446015,7.499833 7.634738,5.298806 13.804506,13.895976 18.509317,25.791527 z"
                id="text2161"
                fill="currentColor"
                fill-opacity="1"
                stroke="none"
                stroke-width=".72233355px"
                stroke-linecap="butt"
                stroke-linejoin="miter"
                stroke-opacity="1"
              />
            </svg>
          </slot>
          <p class="num-down">{{ numDown }}</p>
          <p class="author">{{ author }}</p>
        </div>
      </div>
      <div class="left-side">
        <h2>
          <span>{{ author }}</span>
          <span>{{ title }}</span>
        </h2>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-container {
  z-index: 1;
  perspective: 3000px;
  transform: scale(var(--book-scale, 1));
  transform-origin: center center;
}

.book-container .book {
  position: relative;
  display: block;
  width: 400px;
  height: 550px;
  margin: 5% auto;
  border-radius: 2px 4px 4px 2px;
  background: var(--book-cover-bg);
  font-family: acumin-pro, sans-serif;
  box-shadow: 13px 13px 8px 0px rgba(0, 0, 0, 0.3);
  font-weight: 400;
  color: var(--book-text-color);
  transform-style: preserve-3d;
  transition: transform 0.5s;
}

.book-container .book:hover {
  transform: rotate3d(0, 1, 0, 35deg);
}

.book-container .book > div,
.book-container .front > div {
  display: block;
  position: absolute;
}

.book-container .front {
  transform-style: preserve-3d;
  transform-origin: 0% 50%;
  transition: transform 0.5s;
  transform: translate3d(0, 0, 20px);
  z-index: 10;
}

.book-container .front > div {
  width: 400px;
  height: 550px;
}

.book-container .left-side {
  width: 40px;
  left: -20px;
  height: 550px;
  background-color: var(--book-spine-bg);
  transform: rotate3d(0, 1, 0, -90deg);
}

.cover svg {
  position: absolute;
  top: 50%;
  left: 45%;
  margin-top: -100px;
  margin-left: -110px;
  width: 300px;
  color: var(--book-text-color);
}

#eye-right {
  padding-left: 185px;
}

.cover .num-up {
  position: absolute;
  top: 64px;
  left: 47px;
  letter-spacing: 50px;
  transform: rotate(-90deg);
  color: var(--book-text-color);
}

.cover .num-down {
  position: relative;
  top: 65px;
  left: -95px;
  transform: rotate(-90deg);
  color: var(--book-text-color);
}

.author {
  font-family: acumin-pro, sans-serif;
  font-weight: 400;
  position: absolute;
  top: 475px;
  left: 50px;
  opacity: 0.8;
  color: var(--book-text-color);
}

.book-container .front > div {
  border-radius: 0 3px 3px 0;
  box-shadow: inset 4px 0 10px rgba(0, 0, 0, 0.1);
}

.book-container .front:after {
  content: '';
  position: absolute;
  top: 1px;
  bottom: 1px;
  left: -1px;
  width: 1px;
}

.book-container .cover:after {
  content: '';
  position: absolute;
  top: 0;
  left: 10px;
  bottom: 0;
  width: 3px;
  background: rgba(0, 0, 0, 0.1);
  box-shadow: 1px 0 3px rgba(255, 255, 255, 0.1);
}

.book-container h2 {
  width: 500px;
  height: 40px;
  color: var(--book-text-color);
  font-size: 15px;
  line-height: 40px;
  padding-right: 10px;
  text-align: right;
  transform-origin: 0 0;
  transform: rotate(90deg) translateY(-40px);
}

.cover {
  background: var(--book-cover-bg);
}

.left-side h2 span:first-child {
  font-weight: 400;
  font-size: 13px;
  padding-right: 20px;
}

.left-side h2 span:last-child {
  font-family: acumin-pro, sans-serif;
}
</style>