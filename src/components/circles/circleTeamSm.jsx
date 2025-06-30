export function CircleTeamSm({ className = "", ...props }) {
  return (
    <svg
      className={`absolute h-[130%] w-[220%] top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 ${className}`}
      viewBox="0 0 230 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M214 81.5C118 101.5 41 106 10 61.5C-21 17 57.0918 3.36405 115.686 3.86942C159.85 4.25033 205 4.56377 221 31.5C237 58.4362 209 84 154 95"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}