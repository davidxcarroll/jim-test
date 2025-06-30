export function CircleTeamMd({ className = "", ...props }) {
  return (
    <svg
      className={`absolute h-[130%] w-[220%] top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 ${className}`}
      viewBox="0 0 330 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M64.7394 92.8151C144.739 96.3526 328.633 117.796 328.442 34.9362C328.378 7.18657 230.305 4.2503 166.239 3.86939C81.2393 3.36402 23.2394 10.4392 4.7394 52.8906C-13.7606 95.342 181.734 95.836 217.239 92.3097"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}