/* TODO: components/app-button.js
  - Same pattern as pase-lista components/app-button.js
  - Vue component: AppButton
  - Props:
    type: { type: String, default: 'primary' } (primary, secondary, danger, warning, success, info)
    size: { type: String, default: 'sm' } (sm, md, lg)
    icon: { type: String, default: '' } (Bootstrap icon name, e.g. 'bi-plus')
    loading: { type: Boolean, default: false }
    disabled: { type: Boolean, default: false }
  - Template:
    <button :class="classes" :disabled="disabled || loading" @click="$emit('click')">
      <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
      <i v-if="icon && !loading" :class="[icon, 'me-1']"></i>
      <slot />
    </button>
  - Computed classes based on type and size
*/

export const AppButton = {
  name: 'AppButton',
  template: `
    <button :class="buttonClasses" :disabled="disabled || loading" @click="$emit('click')">
      <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
      <i v-if="icon && !loading" :class="[icon, 'me-1']"></i>
      <slot />
    </button>
  `,
  props: {
    type: { type: String, default: 'primary' },
    size: { type: String, default: 'sm' },
    icon: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    buttonClasses() {
      return ['btn', 'btn-' + this.type, this.size === 'sm' ? 'btn-sm' : this.size === 'lg' ? 'btn-lg' : ''].filter(Boolean);
    },
  },
  emits: ['click'],
};
