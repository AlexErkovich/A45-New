// The stored cover is authoritative, including previously uploaded files.
export function categoryCoverPath(category){return category?.cover_image_path||null}
export function visibleCategory(category){return {...category,cover_image_path:categoryCoverPath(category)}}
