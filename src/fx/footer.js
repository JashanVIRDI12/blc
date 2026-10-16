// The footer's live touch: beside "Talk to us", whether the showroom is
// open now (11 am to 8 pm, Indian time).

const istHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));

export function setupFooter() {
  const status = document.querySelector('[data-footer-open]');
  if (status) {
    const hour = istHour(), open = hour >= 11 && hour < 20;
    status.classList.toggle('is-open', open);
    status.lastElementChild.textContent = open ? 'Open now, till 8 pm IST' : hour < 11 ? 'Opens today at 11 am IST' : 'Closed now, opens tomorrow at 11 am IST';
  }
}
