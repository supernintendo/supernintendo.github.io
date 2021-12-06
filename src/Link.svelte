<script>
  export let onHover = () => {}
  export let onUnhover = () => {}
  export let href = '#';
  export let name = 'link'
</script>

<a
  on:mouseenter={onHover.bind(this, name)}
  on:mouseleave={onUnhover.bind(this, name)}
  href={href}
  target="_blank">
  {name}
</a>

<style>
  a {
    color: var(--theme-night);
    transition: all 0.5s;
  }
</style>