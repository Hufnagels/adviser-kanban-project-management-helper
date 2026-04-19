interface ProjectLogoProps {
  className?: string
  size?: number
}

export default function ProjectLogo({ className, size }: ProjectLogoProps) {
  const dim = size ? `${size}px` : undefined
  return (
    <div className="flex justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        className={className}
        style={dim ? { width: dim, height: dim } : undefined}
      >
        <path fill="#89bbff" d="M223.9,52.3h0c-2.8-1.9-6.5-1.6-8.9.8l-80.7,80.7c-2.7,2.7-7,2.7-9.8.1l-26-24.6c-2.8-2.6-7.2-2.5-9.9.2l-37.7,39.2c-2.7,2.8-2.6,7.2.2,9.9l1.2,1.2c2.5,2.5,6.5,2.7,9.3.4l22.1-17.8c2.7-2.2,6.6-2,9.1.3l34.1,31.7c3,2.8,7.7,2.4,10.3-.8l88.1-111.5c2.5-3.2,1.8-7.8-1.5-10.1v.3Z" />
        <path fill="#47aaff" d="M69.7,164h25.4c1.2,0,2.2,1,2.2,2.2v31.9h-29.7v-32c0-1.1.9-2.1,2.1-2.1h0Z" />
        <path fill="#47aaff" d="M106.7,165.9l18.3,16.5c.5.5,1.3.8,2,.8h5.5c1.1,0,1.9.8,1.9,1.9v26.2h-29.4v-44.7c0-.8,1-1.3,1.6-.7h.1Z" />
        <path fill="#47aaff" d="M144.7,175.8l26.3-31.5c.6-.7,1.7-.3,1.7.6v51.9h-28.8v-19c0-.7.3-1.4.7-2h.1Z" />
        <path fill="#1565b5" d="M224.8,139.8c-1.8-.2-3.6-.4-5.3-.8h0c-1.1,0-2.1.7-2.3,1.8-8.8,50.5-54.9,86.3-105.9,80.8S19.9,167.5,25.7,113.7s1.2-10.3,1.7-14.3-.2-.7-.6-.8-.8-.1-1.2-.2-.7.1-.8.5c-2.2,7-3.6,14.4-4.3,22-4.7,55.2,35.7,104.6,90.7,111.3,56.9,6.8,108.4-33.9,115-90.6,0-.8-.5-1.6-1.3-1.8Z" />
      </svg>
    </div>
  )
}
