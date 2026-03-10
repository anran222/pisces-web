import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Sparkles,
  Wand2,
  Copy,
  Check,
  Loader2,
  FileText,
  Image,
  FlaskConical,
  Upload,
  Palette,
  Edit3,
  X,
  Download,
  ArrowRight,
  BarChart3
} from 'lucide-react'
import { variantAPI } from '../services/api'
import clsx from 'clsx'

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png']

export default function VariantGenerator() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('text') // text, image, image-upload, style-transfer, flow
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)
  
  // 图片上传相关
  const [uploadedImage, setUploadedImage] = useState(null)
  const [uploadedImageBase64, setUploadedImageBase64] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('french-book')
  const [imageStyles, setImageStyles] = useState([])
  const fileInputRef = useRef(null)

  // 完整流程参数
  const [flowParams, setFlowParams] = useState({
    generateCount: 15,
    finalCount: 4,
    visitorCount: 150,
    daysAgo: 7
  })

  // 加载风格列表
  useEffect(() => {
    loadImageStyles()
  }, [])

  const loadImageStyles = async () => {
    try {
      const response = await variantAPI.getImageStyles()
      const styles = response.data || response || []
      setImageStyles(styles)
      if (styles.length > 0 && !styles.some(style => style.id === selectedStyle)) {
        setSelectedStyle(styles[0].id)
      }
    } catch (error) {
      console.error('Failed to load styles:', error)
      setImageStyles([])
      alert('加载风格列表失败: ' + (error.response?.data?.message || error.message))
    }
  }

  const normalizeFlowResult = (responseData) => ({
    ...responseData,
    experimentName: responseData.experimentName || responseData.experimentId,
    analysisSummary: responseData.analysisSummary || '',
    variants: Array.isArray(responseData.variants) ? responseData.variants : []
  })

  const normalizeStyleTransferResult = (responseData) => {
    if (typeof responseData === 'string') {
      const fileName = `style-${selectedStyle}.png`
      const encodedUrl = encodeURIComponent(responseData)
      const encodedFileName = encodeURIComponent(fileName)
      return {
        originalImageUrl: uploadedImage,
        resultImageUrl: responseData,
        downloadFileName: fileName,
        downloadUrl: `/api/variants/image/download?url=${encodedUrl}&fileName=${encodedFileName}`,
        style: selectedStyle
      }
    }

    return {
      originalImageUrl: uploadedImage,
      resultImageUrl: responseData?.resultImageUrl || responseData?.data || '',
      downloadFileName: responseData?.downloadFileName || `style-${selectedStyle}.png`,
      downloadUrl: responseData?.downloadUrl || '',
      style: responseData?.style || selectedStyle
    }
  }

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        alert('当前图生图和风格转换仅支持 JPG、PNG 图片格式')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('图片大小不能超过10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setUploadedImage(event.target.result)
        setUploadedImageBase64(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearUploadedImage = () => {
    setUploadedImage(null)
    setUploadedImageBase64('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    // 图片上传模式需要检查图片
    if ((mode === 'image-upload' || mode === 'style-transfer') && !uploadedImageBase64) {
      alert('请先上传图片')
      return
    }

    // 其他模式需要提示词
    if (mode !== 'style-transfer' && !prompt.trim()) {
        alert(mode === 'image-upload' ? '请输入图生图提示词' : '请输入生成提示词')
      return
    }

    try {
      setLoading(true)
      setResults(null)

      let response
      if (mode === 'text') {
        response = await variantAPI.generateCompleteText(prompt, count * 2, count)
      } else if (mode === 'image') {
        response = await variantAPI.generateImage(prompt, count)
      } else if (mode === 'image-upload') {
        response = await variantAPI.generateImageFromImage(uploadedImageBase64, prompt || '优化图片效果', count)
      } else if (mode === 'style-transfer') {
        response = await variantAPI.styleTransfer(uploadedImageBase64, selectedStyle)
      } else if (mode === 'flow') {
        response = await variantAPI.generateCompleteFlow(
          prompt,
          flowParams.generateCount,
          flowParams.finalCount,
          flowParams.visitorCount,
          flowParams.daysAgo
        )
      }

      // 处理不同的响应格式
      const responseData = response.data || response
      console.log('API响应数据:', responseData)
      
      // 如果响应是数组（图片URL列表），包装成对象
      if (Array.isArray(responseData)) {
        setResults({ data: responseData })
      } else if (mode === 'flow') {
        setResults(normalizeFlowResult(responseData))
      } else if (mode === 'style-transfer') {
        setResults(normalizeStyleTransferResult(responseData))
      } else {
        setResults(responseData)
      }
    } catch (error) {
      console.error('Generation failed:', error)
      alert('生成失败: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold gradient-text">AI 变体生成</h1>
        <p className="text-slate-400 mt-1">使用 AI 智能生成高质量实验变体</p>
      </div>

      {/* Mode Selection */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button
            onClick={() => setMode('text')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
              mode === 'text'
                ? 'bg-pisces-600/30 text-pisces-400 border border-pisces-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <FileText size={18} />
            <span className="text-sm">文本变体</span>
          </button>
          <button
            onClick={() => setMode('image')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
              mode === 'image'
                ? 'bg-pisces-600/30 text-pisces-400 border border-pisces-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <Image size={18} />
            <span className="text-sm">文生图</span>
          </button>
          <button
            onClick={() => setMode('image-upload')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
              mode === 'image-upload'
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <Upload size={18} />
            <span className="text-sm">图生图</span>
          </button>
          <button
            onClick={() => setMode('style-transfer')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
              mode === 'style-transfer'
                ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <Palette size={18} />
            <span className="text-sm">风格转换</span>
          </button>
          <button
            onClick={() => setMode('flow')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl transition-all',
              mode === 'flow'
                ? 'bg-accent-purple/30 text-accent-purple border border-accent-purple/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <FlaskConical size={18} />
            <span className="text-sm">完整流程</span>
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="glass-card p-6 space-y-4">
        {/* 图片上传区域 - 图生图和风格转换模式 */}
        {(mode === 'image-upload' || mode === 'style-transfer') && (
          <div>
            <label className="block text-sm text-slate-400 mb-2">上传原始图片</label>
            <div className="relative">
              {!uploadedImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-pisces-500 hover:bg-slate-800/50 transition-all"
                >
                  <Upload size={48} className="mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400 mb-2">点击或拖拽上传图片</p>
                  <p className="text-slate-500 text-sm">当前仅支持 JPG、PNG，最大 10MB</p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full max-h-96 object-contain rounded-xl bg-slate-800"
                  />
                  <button
                    onClick={clearUploadedImage}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-slate-900/80 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* 风格选择 - 风格转换模式 */}
        {mode === 'style-transfer' && (
          <div>
            <label className="block text-sm text-slate-400 mb-2">选择目标风格</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {imageStyles.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={clsx(
                    'p-3 rounded-xl border transition-all text-left',
                    selectedStyle === style.id
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  )}
                >
                  <p className="font-medium text-sm">{style.name}</p>
                  <p className="text-xs opacity-70 mt-1">{style.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 提示词输入 - 非风格转换模式 */}
        {mode !== 'style-transfer' && (
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              {mode === 'flow' ? '实验主题' : mode === 'image-upload' ? '图生图提示词' : '生成提示词'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'text' 
                  ? "例如：为二手手机价格优化写文案，突出性价比和品质保障" 
                  : mode === 'image'
                  ? "例如：电商商品主图，白色背景，专业摄影风格"
                  : mode === 'image-upload'
                  ? "例如：将人物整体转换为黑白插画风格，保留主体轮廓，背景也同步改为黑白"
                  : "例如：二手手机价格展示方式测试"
              }
              className="input min-h-[100px] resize-none"
            />
          </div>
        )}

        {/* 生成数量 - 非流程模式 */}
        {mode !== 'flow' && mode !== 'style-transfer' && (
          <div>
            <label className="block text-sm text-slate-400 mb-2">生成数量</label>
            <div className="flex gap-2">
              {(mode === 'image-upload' ? [2, 4, 6] : [3, 5, 10]).map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={clsx(
                    'px-4 py-2 rounded-lg transition-all',
                    count === n
                      ? 'bg-pisces-600/30 text-pisces-400 border border-pisces-500/30'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  )}
                >
                  {n} 个
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 流程参数 */}
        {mode === 'flow' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">初始生成数量</label>
              <input
                type="number"
                value={flowParams.generateCount}
                onChange={(e) => setFlowParams({...flowParams, generateCount: parseInt(e.target.value)})}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">最终保留数量</label>
              <input
                type="number"
                value={flowParams.finalCount}
                onChange={(e) => setFlowParams({...flowParams, finalCount: parseInt(e.target.value)})}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">每组访客数</label>
              <input
                type="number"
                value={flowParams.visitorCount}
                onChange={(e) => setFlowParams({...flowParams, visitorCount: parseInt(e.target.value)})}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">实验天数</label>
              <input
                type="number"
                value={flowParams.daysAgo}
                onChange={(e) => setFlowParams({...flowParams, daysAgo: parseInt(e.target.value)})}
                className="input text-sm"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all',
            mode === 'style-transfer' 
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
              : mode === 'image-upload'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600'
              : 'btn-primary'
          )}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              生成中...
            </>
          ) : (
            <>
              {mode === 'style-transfer' ? <Palette size={20} /> : mode === 'image-upload' ? <Edit3 size={20} /> : <Wand2 size={20} />}
              {mode === 'flow' ? '开始完整流程' : mode === 'style-transfer' ? '开始转换' : mode === 'image-upload' ? '生成图片变体' : '生成变体'}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-accent-purple" />
              生成结果
            </h2>
            {results.durationFormatted && (
              <span className="text-sm text-slate-400">耗时: {results.durationFormatted}</span>
            )}
          </div>

          {/* Text Variants */}
          {(mode === 'text' && results.finalVariants) && (
            <div className="space-y-3">
              {results.finalVariants.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 group animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-white">{item.variant}</p>
                      <div className="flex gap-4 mt-2 text-sm text-slate-400">
                        <span>质量分: {(item.qualityScore * 100).toFixed(0)}%</span>
                        <span>预测提升: {(item.predictedLift * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.variant, index)}
                      className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedIndex === index ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image Variants - 文生图模式 */}
          {(mode === 'image' && results.data) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.data.map((url, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center overflow-hidden animate-slide-up group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {url.startsWith('http') ? (
                    <div className="relative w-full h-full">
                      <img src={url} alt={`Generated ${index + 1}`} className="w-full h-full object-cover" />
                      <a
                        href={url}
                        download
                        target="_blank"
                        className="absolute bottom-2 right-2 p-2 rounded-lg bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Image size={32} className="mx-auto text-slate-600 mb-2" />
                      <p className="text-slate-500 text-xs break-all">{url}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Image Variants - 图生图模式 */}
          {(mode === 'image-upload' && results.data) && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 overflow-x-auto pb-2">
                <div className="flex-shrink-0">
                  <p className="text-xs text-slate-500 mb-1">原图</p>
                  <img
                    src={uploadedImage}
                    alt="Original"
                    className="w-24 h-24 object-cover rounded-lg border-2 border-slate-600"
                  />
                </div>
                <div className="text-2xl text-slate-500">→</div>
                {results.data.map((url, index) => (
                  <div key={index} className="flex-shrink-0">
                    <p className="text-xs text-slate-500 mb-1">变体 {index + 1}</p>
                    {url.startsWith('http') ? (
                      <img
                        src={url}
                        alt={`Variant ${index + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border-2 border-emerald-500/50"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-slate-800 rounded-lg flex items-center justify-center">
                        <Image size={24} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.data.map((url, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden group relative"
                  >
                    {url.startsWith('http') ? (
                      <>
                        <img src={url} alt={`Variant ${index + 1}`} className="w-full h-full object-cover" />
                        <a
                          href={url}
                          download
                          target="_blank"
                          className="absolute bottom-2 right-2 p-2 rounded-lg bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Download size={16} />
                        </a>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center p-4">
                          <Image size={32} className="mx-auto text-slate-600 mb-2" />
                          <p className="text-slate-500 text-xs">未返回可展示图片</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Style Transfer Result */}
          {mode === 'style-transfer' && results?.resultImageUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div>
                  <p className="text-white font-medium">风格转换结果已生成</p>
                  <p className="text-sm text-slate-400 mt-1">
                    当前风格：{imageStyles.find(s => s.id === results.style)?.name || results.style}
                  </p>
                </div>
                {results.downloadUrl && (
                  <a
                    href={results.downloadUrl}
                    download={results.downloadFileName}
                    className="btn-primary flex items-center gap-2 whitespace-nowrap"
                  >
                    <Download size={16} />
                    下载成品
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">转换前</p>
                    <span className="text-xs text-slate-500">原始上传</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                    <img
                      src={results.originalImageUrl || uploadedImage}
                      alt="Original"
                      className="w-full max-h-[520px] object-contain"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-amber-200">转换后</p>
                    <span className="text-xs text-amber-300/80">
                      {imageStyles.find(s => s.id === results.style)?.name || results.style}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-slate-950/60">
                    <img
                      src={results.resultImageUrl}
                      alt="Styled"
                      className="w-full max-h-[520px] object-contain"
                    />
                  </div>
                  <div className="flex justify-end">
                    {results.downloadUrl && (
                      <a
                        href={results.downloadUrl}
                        download={results.downloadFileName}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-slate-950/70 px-4 py-2 text-sm text-white hover:bg-slate-900 transition-colors"
                      >
                        <Download size={16} />
                        下载图片
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flow Results */}
          {mode === 'flow' && results.success && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-emerald-400 font-medium">✓ 实验流程完成</p>
                <p className="text-slate-400 text-sm mt-1">实验名称: {results.experimentName}</p>
                <p className="text-slate-400 text-sm mt-1">实验ID: {results.experimentId}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => navigate(`/experiments/${results.experimentId}`)} className="btn-secondary flex items-center gap-2">
                    <ArrowRight size={16} /> 查看实验详情
                  </button>
                  <button onClick={() => navigate(`/analysis/${results.experimentId}`)} className="btn-primary flex items-center gap-2">
                    <BarChart3 size={16} /> 查看分析报告
                  </button>
                </div>
              </div>

              {results.variants && (
                <div className="space-y-3">
                  <h3 className="text-white font-medium">实验结果</h3>
                  {results.variants.map((variant, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">
                          变体 {variant.variantIndex}
                          {variant.isBaseline && <span className="ml-2 text-xs text-slate-400">(基准)</span>}
                        </span>
                        {variant.winRate && (
                          <span className={`font-bold ${variant.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            胜率: {variant.winRate.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm mb-2">{variant.variant}</p>
                      <div className="flex gap-4 text-sm text-slate-400">
                        <span>访客: {variant.visitorCount?.toLocaleString()}</span>
                        <span>转化率: {((variant.conversionRate || 0) * 100).toFixed(2)}%</span>
                        {variant.conversionRateChangePercent !== undefined && (
                          <span className={variant.isBetter ? 'text-emerald-400' : 'text-red-400'}>
                            {variant.conversionRateChangePercent >= 0 ? '+' : ''}
                            {variant.conversionRateChangePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {results.bestVariant && (
                <div className="p-4 rounded-xl bg-accent-purple/10 border border-accent-purple/30">
                  <p className="text-accent-purple font-medium">🏆 最佳变体</p>
                  <p className="text-white mt-1">{results.bestVariant.variant}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    胜率: {results.bestVariant.winRate?.toFixed(1)}% | 
                    转化率: {((results.bestVariant.conversionRate || 0) * 100).toFixed(2)}%
                  </p>
                </div>
              )}

              {results.analysisSummary && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <p className="text-white font-medium mb-2">AI 分析摘要</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{results.analysisSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* Statistics */}
          {results.statistics && (
            <div className="p-4 rounded-xl bg-slate-800/50">
              <h3 className="text-white font-medium mb-2">生成统计</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">初始生成</span>
                  <p className="text-white">{results.statistics.totalGenerated}</p>
                </div>
                <div>
                  <span className="text-slate-500">筛选后</span>
                  <p className="text-white">{results.statistics.afterFiltering}</p>
                </div>
                <div>
                  <span className="text-slate-500">最终选择</span>
                  <p className="text-white">{results.statistics.finalSelected}</p>
                </div>
                <div>
                  <span className="text-slate-500">平均质量分</span>
                  <p className="text-white">{results.statistics.averageQualityScore}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="glass-card p-6">
        <h3 className="text-white font-medium mb-3">💡 使用技巧</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>• <strong className="text-slate-300">文本变体</strong>：输入明确的目标和风格要求，AI 会生成多种不同表达的文案</li>
          <li>• <strong className="text-slate-300">文生图</strong>：描述商品特征和场景，从零开始生成多种风格的图片</li>
          <li>• <strong className="text-emerald-400">图生图</strong>：上传原始图片，输入修改需求，AI 会基于原图生成多个变体</li>
          <li>• <strong className="text-amber-400">风格转换</strong>：上传图片并选择目标风格，一键将图片转换为卡通、油画、素描等风格</li>
          <li>• <strong className="text-slate-300">完整流程</strong>：一键完成变体生成、实验创建、真实事件数据生成和分析，快速验证想法</li>
        </ul>
      </div>
    </div>
  )
}
